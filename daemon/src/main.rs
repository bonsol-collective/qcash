// Business Source License 1.1 (BSL 1.1)
// Licensor: Bonsol Labs Inc.
// Licensed Work: QCash
// Change Date: 2030-12-31
// Change License: Apache License 2.0
// Use of this software is governed by the LICENSE file.

use qcash_core::{QSPVGuestInput};
use std::time::{Duration, Instant};
use std::thread;
use std::sync::mpsc;
use base64::Engine;
use byteorder::{NativeEndian, ReadBytesExt, WriteBytesExt};
use serde::{Deserialize, Serialize};
use std::{panic};
use std::io::{self, Read, Write};
use risc0_zkvm::{default_prover, ExecutorEnv, ProverOpts, Receipt};
use methods::GUEST_ELF;

#[derive(Deserialize)]
#[serde(tag = "action", content = "payload")]
enum Request {
    Init, 
    Send { 
        receiver: String, 
        amount: u64, 
        proof_inputs: QSPVGuestInput 
    }
}

#[derive(Serialize)]
struct Response {
    status: String,
    data: serde_json::Value,
}

fn main() {

    loop {
        // Read Length (4 bytes)
        let len = match io::stdin().read_u32::<NativeEndian>() {
            Ok(l) => l as usize,
            Err(_) => break, 
        };

        // Read Payload
        let mut buf = vec![0u8; len];
        if io::stdin().read_exact(&mut buf).is_err() {
            break;
        }

        // Process Request
        match serde_json::from_slice::<Request>(&buf) {
            Ok(req) => {
                let resp = handle(req);
                send_response(&resp);
            }, 
            Err(e) => {
                eprintln!("[DAEMON] JSON Parse Error: {}", e);
                let resp = Response {
                    status: "error".into(),
                    data: serde_json::json!(format!("Invalid JSON format: {}", e)),
                };
                send_response(&resp);
            }
        }
    }
}

fn handle(req: Request) -> Response {

    match req {
        Request::Init => {
            // New Behavior: Just acknowledge the daemon is running
            Response {
                status: "success".into(),
                data: serde_json::json!({
                    "msg": "Daemon Ready (Stateless Mode)",
                    "version": "1.0.0"
                }) 
            }
        },
        Request::Send { receiver: _, amount, proof_inputs } => {
            eprintln!("[DAEMON] Received Send Request. Amount: {}", amount);

            // Validation: Ensure the Extension actually sent inputs
            if proof_inputs.input_utxos.is_empty() {
                 return Response {
                    status: "error".into(),
                    data: serde_json::json!("No input UTXOs provided in request")
                };
            }

            eprintln!("[DAEMON] Starting proof generation with keep-alive...");
            let start_time = Instant::now();

            // Channel to receive proof result from worker thread
            let (tx, rx) = mpsc::channel::<Result<Receipt, String>>();

            // Spawn prover in background thread
            thread::spawn(move || {
                let result = panic::catch_unwind(|| {
                    let env = ExecutorEnv::builder()
                        .write(&proof_inputs)
                        .unwrap()
                        .build()
                        .unwrap();
                    
                    let prover = default_prover();
                    prover.prove(env, GUEST_ELF)
                });

                match result {
                    Ok(Ok(info)) => tx.send(Ok(info.receipt)).ok(),
                    Ok(Err(e)) => tx.send(Err(format!("Prover Error: {}", e))).ok(),
                    Err(panic_info) => {
                        let msg = if let Some(s) = panic_info.downcast_ref::<&str>() {
                            format!("Guest panicked: {}", s)
                        } else if let Some(s) = panic_info.downcast_ref::<String>() {
                            format!("Guest panicked: {}", s)
                        } else {
                            "Prover Panicked (unknown reason)".to_string()
                        };
                        tx.send(Err(msg)).ok()
                    }
                };
            });

            // Send keep-alive messages while waiting for prover
            let heartbeat_interval = Duration::from_secs(30);
            loop {
                match rx.recv_timeout(heartbeat_interval) {
                    Ok(Ok(receipt)) => {
                        // Prover finished successfully
                        let elapsed = start_time.elapsed();
                        eprintln!("[DAEMON] Proof generated in {:.2}s", elapsed.as_secs_f64());
                        
                        let proof_b64 = base64::engine::general_purpose::STANDARD.encode(
                            bincode::serialize(&receipt).unwrap()
                        );
                        
                        return Response { 
                            status: "success".into(), 
                            data: serde_json::json!({
                                "proof": proof_b64, 
                                "proving_time_secs": elapsed.as_secs_f64()
                            }) 
                        };
                    },
                    Ok(Err(e)) => {
                        // Prover failed
                        let elapsed = start_time.elapsed();
                        eprintln!("[DAEMON] Proof failed in {:.2}s: {}", elapsed.as_secs_f64(), e);
                        
                        return Response { 
                            status: "error".into(), 
                            data: serde_json::json!({
                                "msg": e
                            }) 
                        };
                    },
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // Send heartbeat to keep connection alive
                        let elapsed = start_time.elapsed().as_secs();
                        eprintln!("[DAEMON] Still proving... ({}s elapsed)", elapsed);
                        
                        // Send progress message
                        let heartbeat = Response {
                            status: "progress".into(),
                            data: serde_json::json!({
                                "msg": format!("Proving in progress... ({}s)", elapsed),
                                "elapsed_secs": elapsed
                            })
                        };
                        send_response(&heartbeat);
                    },
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        eprintln!("[DAEMON] Prover thread died unexpectedly");
                        return Response { 
                            status: "error".into(), 
                            data: serde_json::json!({
                                "msg": "Prover thread died unexpectedly"
                            }) 
                        };
                    }
                }
            }
        }
    }
}



fn send_response(resp: &Response) {
    let out = serde_json::to_vec(resp).unwrap();
    
    // Handle broken pipe gracefully
    if let Err(e) = io::stdout().write_u32::<NativeEndian>(out.len() as u32) {
        eprintln!("[DAEMON] Failed to write response length: {} (pipe might be closed)", e);
        // Try to save successful proofs to file as fallback
        if resp.status == "success" {
            save_proof_to_file(resp);
        }
        return;
    }
    
    if let Err(e) = io::stdout().write_all(&out) {
        eprintln!("[DAEMON] Failed to write response: {} (pipe might be closed)", e);
        if resp.status == "success" {
            save_proof_to_file(resp);
        }
        return;
    }
    
    if let Err(e) = io::stdout().flush() {
        eprintln!("[DAEMON] Failed to flush: {} (pipe might be closed)", e);
    }
}

fn save_proof_to_file(resp: &Response) {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let proof_path = format!("{}/Desktop/bonsol/qcash/logs/pending_proof.json", home);
    
    match std::fs::write(&proof_path, serde_json::to_string_pretty(resp).unwrap()) {
        Ok(_) => eprintln!("[DAEMON] Proof saved to {} (pipe was closed)", proof_path),
        Err(e) => eprintln!("[DAEMON] Failed to save proof to file: {}", e),
    }
}
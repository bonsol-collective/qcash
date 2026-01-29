use qcash_core::{QSPVGuestInput};
use std::time::Instant;
use base64::Engine;
use byteorder::{NativeEndian, ReadBytesExt, WriteBytesExt};
use serde::{Deserialize, Serialize};
use std::{panic};
use std::io::{self, Read, Write};
use risc0_zkvm::{default_prover, ExecutorEnv};
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

            eprintln!("[DAEMON] Starting proof generation...");
            let start_time = Instant::now();

            // Run the RISC Zero Prover
            let prove_result = panic::catch_unwind(|| {
                let env = ExecutorEnv::builder()
                    .write(&proof_inputs)
                    .unwrap()
                    .build()
                    .unwrap();
                
                let prover = default_prover();
                prover.prove(env, GUEST_ELF)
            });

            let elapsed = start_time.elapsed();
            eprintln!("[DAEMON] Proof generated in {:.2}s", elapsed.as_secs_f64());

            match prove_result {
                Ok(Ok(info)) => {
                    // Encode receipt to Base64
                    let proof_b64 = base64::engine::general_purpose::STANDARD.encode(
                        bincode::serialize(&info.receipt).unwrap()
                    );
                    
                    Response { 
                        status: "success".into(), 
                        data: serde_json::json!({
                            "proof": proof_b64, 
                            "proving_time_secs": elapsed.as_secs_f64()
                        }) 
                    }
                },
                Ok(Err(e)) => {
                    Response { 
                        status: "error".into(), 
                        data: serde_json::json!({
                            "msg": format!("Prover Error: {}", e)
                        }) 
                    }
                },
                Err(_) => {
                    Response { 
                        status: "error".into(), 
                        data: serde_json::json!({
                            "msg": "Prover Panicked (check guest code constraints)"
                        }) 
                    }
                }
            }
        }
    }
}

fn send_response(resp: &Response) {
    let out = serde_json::to_vec(resp).unwrap();
    io::stdout().write_u32::<NativeEndian>(out.len() as u32).unwrap();
    io::stdout().write_all(&out).unwrap();
    io::stdout().flush().unwrap();
}
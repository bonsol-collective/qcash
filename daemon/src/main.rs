use core::{DecryptedInput, UTXOEncryptedPayload, UTXOCommitmentHeader, QSPVGuestInput, HASH};
use std::time::Instant;
use base64::Engine;
use byteorder::{NativeEndian, ReadBytesExt, WriteBytesExt};
use serde::{Serialize, Deserialize};
use sha2::{Digest,Sha256};
use std::{fs, panic};
use std::io::{self, Read, Write};
use risc0_zkvm::{default_prover, ExecutorEnv};
use methods::GUEST_ELF;
mod key_manager;
use key_manager::*;

#[derive(Serialize, Deserialize, Default)]
struct WalletDB{
    mnemonic:String,
    solana_address:String,
    last_ledger_tip: HASH,
    // In a real app, we scan ledger to find these. Here we store them.
    unspent_utxos:Vec<DecryptedInput>
}

#[derive(Deserialize)]
#[serde(tag = "action", content = "payload")]
enum Request{
    Init,
    // Debug: Mint a UTXO so we have something to spend
    Faucet {amount:u64},
    Send { receiver:String,amount:u64  }
}

#[derive(Serialize)]
struct Response{
    status:String,
    data: serde_json::Value,
}

fn main(){
    // Ensure DB exists
    if !std::path::Path::new("wallet.json").exists(){
        let empty = WalletDB::default();
        fs::write("wallet.json",serde_json::to_string(&empty).unwrap()).unwrap();
    }

    loop{
        let len = match io::stdin().read_u32::<NativeEndian>(){
            Ok(l)=> l as usize,
            Err(_)=> break,
        };

        let mut buf = vec![0u8;len];

        if io::stdin().read_exact(&mut buf).is_err() {
            break;
        }

        if let Ok(req) = serde_json::from_slice::<Request>(&buf){
            let resp = handle(req);
            let out = serde_json::to_vec(&resp).unwrap();
            io::stdout().write_u32::<NativeEndian>(out.len() as u32).unwrap();
            io::stdout().write_all(&out).unwrap();
            io::stdout().flush().unwrap();
        }
    }
}

fn handle(req:Request)->Response{
    let mut db:WalletDB = serde_json::from_str(&fs::read_to_string("wallet.json").unwrap()).unwrap();

    match req{
        Request::Init=>{
            let keys = WalletKeys::new();

            db.mnemonic = keys.mnemonic.clone();
            db.solana_address = keys.get_solana_address();
            // Genesis Ledger Tip
            db.last_ledger_tip = [0u8; 32];
            save(&db);
            Response {
                status: "success".into(),
                data: serde_json::json!({
                    "msg": "Wallet Initialized",
                    "mnemonic": keys.mnemonic,
                    "solana_address": db.solana_address,
                    "kyber_public_key": bs58::encode(keys.kyber_key.public).into_string()
                }) }
        },
        Request::Faucet{amount}=>{

            if db.mnemonic.is_empty(){
                return Response {
                    status: "error".into(),
                    data: serde_json::json!({"msg": "Wallet not initialized"})
                };
            }

            let keys = WalletKeys::from_mnemonic(&db.mnemonic);

            // Manually Creating a UTXO for testing
            let mock_payload = UTXOEncryptedPayload{
                amount,
                is_return: false,
                receiver_vault: keys.kyber_key.public,
                randomness: [1u8; 32],
                utxo_spent_list: vec![],
                version: 1,
            };

            // Calculate the payload hash (must match guest program's hash_payload function)
            let mut hasher = Sha256::new();
            hasher.update(mock_payload.amount.to_le_bytes());
            hasher.update(mock_payload.receiver_vault);
            hasher.update(mock_payload.randomness);
            for h in &mock_payload.utxo_spent_list {
                hasher.update(h);
            }
            let ciphertext_commitment: [u8; 32] = hasher.finalize().into();

            // Calculate the UTXO hash
            let mut hasher = Sha256::new();
            hasher.update(ciphertext_commitment);
            hasher.update(db.last_ledger_tip);
            hasher.update(1u32.to_le_bytes()); // epoch
            let utxo_hash: [u8; 32] = hasher.finalize().into();

            let mock_header = UTXOCommitmentHeader{
                utxo_hash,
                prev_utxo_hash: db.last_ledger_tip,
                ciphertext_commitment,
                epoch: 1,
            };

            // In real app, we must match the hashing logic exactly or proof fails
            // For now, assumes this is a valid  UTXO from history

            db.unspent_utxos.push(DecryptedInput{
                header:mock_header,
                payload:mock_payload,
            });

            save(&db);

            Response { status: "success".into(), data: serde_json::json!({"msg": "Faucet Received"}) }
        },
        Request::Send{receiver,amount}=>{

            if db.unspent_utxos.is_empty(){
                return Response{
                    status:"error".into(),
                    data: serde_json::json!("No Funds")
                };
            };

            let keys = WalletKeys::from_mnemonic(&db.mnemonic);

            // decode receiver Public key (hex->Bytes)
            let receiver_pubkey_bytes = match bs58::decode(&receiver).into_vec(){
                Ok(b)=>{
                    if b.len() != 1184 {
                        return Response { status: "error".into(), data: serde_json::json!("Invalid Kyber Key Length") };
                    }

                    let mut arr = [0u8;1184];
                    arr.copy_from_slice(&b);
                    arr
                },
                Err(_) => return Response { status: "error".into(), data: serde_json::json!("Invalid Receiver Hex") }
            };

            // construct Prover Input
            println!("[DAEMON] Constructing prover input...");
            let input = QSPVGuestInput{
                sender_private_key_fragment:keys.secret_entropy,
                input_utxos: db.unspent_utxos.clone(),
                receiver_pubkey:receiver_pubkey_bytes,
                amount_to_send:amount,
                receiver_randomness:[4u8; 32], // RNG in prod
                return_randomness: [5u8; 32],   // RNG in prod
                current_ledger_tip: db.last_ledger_tip,
            };

            println!("[DAEMON] Input constructed. Amount: {}, UTXOs: {}", amount, db.unspent_utxos.len());

            println!("[DAEMON] Starting proof generation... This may take 30s-5min depending on hardware");
            let start_time = Instant::now();

            let prove_result = panic::catch_unwind(|| {
                let env = ExecutorEnv::builder().write(&input).unwrap().build().unwrap();
                let prover = default_prover();
                prover.prove(env, GUEST_ELF)
            });

            let elapsed = start_time.elapsed();
            println!("[DAEMON] Proving attempt completed in {:.2}s", elapsed.as_secs_f64());

            match prove_result {
                Ok(Ok(info)) => {
                    // UPDATE STATE (Optimistic)
                    // We effectively spent everything.
                    // In a real app, we wait for Solana finality, then download our new Return UTXO.
                    db.unspent_utxos.clear();
                    save(&db);

                    let proof = base64::engine::general_purpose::STANDARD.encode(bincode::serialize(&info.receipt).unwrap());
                    Response { status: "success".into(), data: serde_json::json!({"proof": proof, "proving_time_secs": elapsed.as_secs_f64()}) }
                },
                Ok(Err(e)) => Response { status: "error".into(), data: serde_json::json!({"msg": format!("Prove error: {}", e)}) },
                Err(_) => Response { status: "error".into(), data: serde_json::json!({"msg": "Prover Panic"}) }
            }
        }
    }
}

fn save(db: &WalletDB) {
    fs::write("wallet.json", serde_json::to_string(db).unwrap()).unwrap();
}

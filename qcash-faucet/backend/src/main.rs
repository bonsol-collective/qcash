use std::{  str::FromStr, sync::Arc};

use actix_cors::Cors;
use actix_web::{App, HttpResponse, HttpServer, Responder, get, post, web};
use anchor_client::{Client, Cluster, anchor_lang::prelude::system_program, solana_sdk::{pubkey::Pubkey, signature::Keypair, signer::{SeedDerivable, Signer}}};
use borsh::{BorshDeserialize, BorshSerialize};
use chacha20poly1305::{ChaCha20Poly1305, Key, KeyInit, Nonce, aead::{Aead}};
use pqc_kyber::encapsulate;
use qcash_core::UTXOEncryptedPayload;

use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const PROGRAM_ID:&str = "DMiW8pL1vuaRSG367zDRRkSmQM8z5kKUGU3eC9t7AFDT";
const KYBER_PUBKEY_SIZE:usize = 1184;
const LEDGER_SEED: &[u8] = b"ledger";
const MIN_SOL_BALANCE: u64 = 100_000_000; // 0.1 SOL in lamports
const RPC_URL:&str = "http://localhost:8899";

// Mirror Struct
#[derive(BorshSerialize)]
struct UploadCiphertextArgs{
    pub ciphertext:[u8;1088]
}

#[derive(BorshSerialize)]
struct TransferArgs{
    pub encrypted_payload:Vec<u8>,
    pub nonce:[u8;12],
}

// Sha256("global:<function_name>")
pub fn get_discriminator(name:&str)->Vec<u8>{
    let mut hasher = Sha256::new();
    hasher.update(format!("global:{}",name).as_bytes());
    let result = hasher.finalize();
    result[..8].to_vec()
}

struct AppState{
    authority: Arc<Keypair>,
    program_id:Pubkey,
    client: Arc<Client<Arc<Keypair>>>,
}

#[derive(Deserialize)]
struct AirDropRequest{
    vault_pda:String,
}

#[derive(Serialize)]
struct AirDropResponse{
    signature:String,
    utxo_hash:String,
}

#[derive(BorshDeserialize)]
pub struct VaultState{
    pub version:u8,
    pub flags: u8,
    pub kyber_key:Vec<u8>
}

#[derive(Serialize)]
struct ErrorResponse{
    error:String
}

#[get("/status")]
async fn status(data:web::Data<AppState>)-> impl Responder{
    let pubkey = data.authority.pubkey();
    HttpResponse::Ok().body(format!("faucet running. Authority {}", pubkey))
}

#[post("/airdrop")]
async fn get_airdrop(data:web::Data<AppState>,req:web::Json<AirDropRequest>)->impl Responder{
    println!("Received Airdrop Request for Vault: {}", req.vault_pda);

    let authority_pubkey = data.authority.pubkey();

    // Check if faucet has SOL balance
    let solana_client = solana_client::rpc_client::RpcClient::new(RPC_URL);
    // Convert anchor_client's Pubkey to solana_sdk's Pubkey
    let authority_sdk_pubkey = solana_sdk::pubkey::Pubkey::new_from_array(authority_pubkey.to_bytes());
    let balance = match solana_client.get_balance(&authority_sdk_pubkey) {
        Ok(b) => b,
        Err(e) => return HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("Failed to fetch balance: {}", e)
        })
    };

    if balance < MIN_SOL_BALANCE {
        return HttpResponse::ServiceUnavailable().json(ErrorResponse {
            error: "Insufficient SOL balance for faucet".into()
        });
    }
    // parse the string to pubkey
    let vault_pda = match Pubkey::from_str(&req.vault_pda){
        Ok(p)=>p,
        Err(_)=> return HttpResponse::BadRequest().json(ErrorResponse{
            error:"Invalid Vault PDA".into()
        })
    };

    // fetch account data from solana
    let program = data.client.program(data.program_id).expect("Invalid Program");

    let account = match program.rpc().get_account(&vault_pda){
        Ok(acc)=>acc,
        Err(_)=> return HttpResponse::BadRequest().json(ErrorResponse{
            error:format!("Vault not found: {}",vault_pda)
        })
    };

    // Deserialize Vault state
    if account.data.len() < 8 {
        return HttpResponse::InternalServerError().json(ErrorResponse{
            error: "Account data is too short".into()
        })
    }

    let mut data_slice = &account.data[8..];
    let vault_data = match VaultState::deserialize(&mut data_slice){
        Ok(data)=>data,
        Err(e)=> return HttpResponse::InternalServerError().json(ErrorResponse{
            error:format!("Deserialization failed {}",e)
        }),
    };

    // extracting and vaildating the Kyber key

    let receiver_key_bytes = vault_data.kyber_key;

    if receiver_key_bytes.len() != KYBER_PUBKEY_SIZE {
        return HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("On-Chain Kyber Key size mismatch. Expected {}, got {}", KYBER_PUBKEY_SIZE, receiver_key_bytes.len())
        });
    }

    let mut receiver_array = [0u8;KYBER_PUBKEY_SIZE];
    receiver_array.copy_from_slice(&receiver_key_bytes);

    println!("Fetched Kyber Key from Chain");

    // randomness
    let mut rng = OsRng;
    let mut payload_randomness = [0u8; 32];
    rng.try_fill_bytes(&mut payload_randomness).expect("Error filling bytes");

    // Encapsulate
    let (ciphertext,shared_secret) = match encapsulate(&receiver_array, &mut rng){
        Ok(res)=>res,
        Err(_)=> return HttpResponse::InternalServerError().json(ErrorResponse { error: "Kyber Encapsulation Failed".into() })
    };

    // construct Payload
    let utxo_payload = UTXOEncryptedPayload{
        amount:100,
        is_return:false,
        receiver_vault: vault_pda.to_bytes(),
        randomness:payload_randomness,
        utxo_spent_list: vec![],
        version: 1,
    };

    let payload_bytes = bincode::serialize(&utxo_payload).expect("Serialization Failed");

    // symmetric_encryption
    let key = Key::from_slice(&shared_secret);
    let cipher = ChaCha20Poly1305::new(key);
    let mut nonce_bytes = [0u8; 12];
    rng.try_fill_bytes(&mut  nonce_bytes).expect("Error filling bytes");

    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted_payload = match cipher.encrypt(nonce, payload_bytes.as_ref()){
        Ok(ct)=>ct,
        Err(_) => return HttpResponse::InternalServerError().json(ErrorResponse { error: "Symmetric Encryption Failed".into() }),
    };

    println!("Encryption Complete {:?}",encrypted_payload);

    // The Loader Pattern
    // Create a temporary Loader Account
    // This account will hold the 1088 bytes kyber ciphertext
    let loader_keypair = Keypair::new();
    let loader_pubkey = loader_keypair.pubkey();

    let mut ct_array = [0u8;1088];
    ct_array.copy_from_slice(ciphertext.as_ref());

    let mut upload_ix_data = get_discriminator("upload_ciphertext");
    let upload_args = UploadCiphertextArgs{
        ciphertext:ct_array
    };
    upload_ix_data.extend_from_slice(&borsh::to_vec(&upload_args).unwrap());

    // Build Ix 1
    // Used anchor_client's re-exported solana_sdk to avoid version conflicts
    use anchor_client::solana_sdk::instruction::{Instruction, AccountMeta};
    let sig1 = program.request().instruction(
        Instruction{
            program_id:data.program_id,
            accounts: vec![
                AccountMeta::new(loader_pubkey, true),
                AccountMeta::new(data.authority.pubkey(),true),
                AccountMeta::new_readonly(system_program::ID,false)
            ],
            data: upload_ix_data,
        }
    )
    .signer(&loader_keypair)
    .signer(&*data.authority)
    .send();

    if let Err(e) = sig1 {
        return HttpResponse::InternalServerError().json(ErrorResponse{
            error: format!("Upload Failed: {}",e)
        });
    }

    // Transfer Ix

    let (ledger_pda,_) = Pubkey::find_program_address(&[b"ledger"], &data.program_id);

    // Build Ix 2
    let mut transfer_ix_data = get_discriminator("transfer");
    let transfer_args = TransferArgs{
        encrypted_payload,
        nonce:nonce_bytes
    };

    transfer_ix_data.extend_from_slice(&borsh::to_vec(&transfer_args).unwrap());

    let sig2 = program.request()
            .instruction(solana_sdk::instruction::Instruction{
                program_id:data.program_id,
                accounts:vec![
                    solana_sdk::instruction::AccountMeta::new(data.authority.pubkey(), true),
                    solana_sdk::instruction::AccountMeta::new(ledger_pda, false),
                    solana_sdk::instruction::AccountMeta::new(loader_pubkey, false),
                    solana_sdk::instruction::AccountMeta::new_readonly(system_program::ID, false)
                ],
                data: transfer_ix_data
            })
            .signer(&*data.authority)
            .send();

    match sig2 {
        Ok(s)=> HttpResponse::Ok().json(AirDropResponse{
            signature:s.to_string(),
            utxo_hash: "Pending".into()
        }),
        Err(e)=> HttpResponse::InternalServerError().json(ErrorResponse { error: format!("Transfer Failed: {}", e) }),

    }
}

#[actix_web::main]
async fn main()->std::io::Result<()> {
    dotenv::dotenv().ok();

    println!("Initializing Qcash Faucet");

    let key_str = std::env::var("FAUCET_KEY").expect("FAUCET_KEY must be set in .env");
    let key_bytes:Vec<u8> = serde_json::from_str(&key_str).expect("Invalid JSON in the FAUCET_KEY");
    let authority = Keypair::from_seed(&key_bytes).expect("Invalid Keypair bytes");

    let authority =Arc::new(authority);
    let pubkey = authority.pubkey();

    let client = Client::new(Cluster::Localnet, authority.clone());
    let client = Arc::new(client);
    let program_id = Pubkey::from_str(PROGRAM_ID).expect("Unable to parse program Id");

    println!("Authority Loaded: {}", pubkey);

    let state = web::Data::new(AppState{
        authority,
        program_id,
        client
    });

    HttpServer::new(move ||{
        // TODO: Change the CORS settings before deploying to production
        let cors = Cors::permissive();

        App::new()
            .wrap(cors)
            .app_data(state.clone())
            .service(status)
            .service(get_airdrop)
    })
    .bind(("0.0.0.0",3000))?
    .run()
    .await

}

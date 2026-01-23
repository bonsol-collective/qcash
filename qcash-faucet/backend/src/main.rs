use std::{ str::FromStr, sync::Arc};

use actix_cors::Cors;
use actix_web::{App, HttpResponse, HttpServer, Responder, get, post, web};
use anchor_client::{Client, Cluster, solana_sdk::{pubkey::Pubkey, signature::Keypair, signer::{SeedDerivable, Signer}}};
use borsh::BorshDeserialize;
use pqc_kyber::encapsulate;
use qcash_core::UTXOEncryptedPayload;

use rand::{TryRngCore, rngs::OsRng};
use rand::RngCore;
use serde::{Deserialize, Serialize};

const PROGRAM_ID:&str = "AFdP6ozXCdssyUwFiiny7CixRRBL5KkJtxw8U3EFCWYD";
const KYBER_PUBKEY_SIZE:usize = 1186;

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
    println!("📩 Received Airdrop Request for Vault: {}", req.vault_pda);

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
            error: format!("On-Chain Kyber Key size mismatch. Expected {}, got {}", KYBER_PUBKEY_SIZE, receiver_bytes.len())
        });
    }

    let mut receiver_array = [0u8;KYBER_PUBKEY_SIZE];
    receiver_array.copy_from_slice(&receiver_array);

    println!("Fetched Kyber Key from Chain");

    // preparing payload

    // randomness
    let mut rng = OsRng;
    let mut randomness = [0u8; 32];
    rng.try_fill_bytes(&mut randomness).expect("Error filling bytes");

    // construct Payload
    let utxo_payload = UTXOEncryptedPayload{
        amount:100,
        is_return:false,
        receiver_vault: receiver_array,
        randomness,
        utxo_spent_list: vec![],
        version: 1,
    };

    // encrypt
    let payload_bytes = bincode::serialize(&utxo_payload).expect("Serialization Failed");
    let (ciphertext,_sharded_secret) = match encapsulate(&receiver_array, &mut rng){
        Ok(res)=>res,
        Err(_)=> return HttpResponse::InternalServerError().json(ErrorResponse { error: "Kyber Encapsulation Failed".into() })
    };

    println!("KEM Success. Shared Secret Generated.");

    return HttpResponse::BadRequest().json(ErrorResponse{
        error:"jdjd".into()
    });

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

    println!("✅ Authority Loaded: {}", pubkey);

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
    })
    .bind(("0.0.0.0",3000))?
    .run()
    .await

}

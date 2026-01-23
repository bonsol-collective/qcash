use std::sync::Arc;

use actix_cors::Cors;
use actix_web::{App, HttpResponse, HttpServer, Responder, get, web};
use anchor_client::{Client, Cluster, solana_sdk::{signature::Keypair, signer::Signer}};

struct AppState{
    authority: Arc<Keypair>,
    client: Arc<Client<Arc<Keypair>>>,
}

#[get("/status")]
async fn status(data:web::Data<AppState>)-> impl Responder{
    let pubkey = data.authority.pubkey();
    HttpResponse::Ok().body(format!("faucet running. Authority {}", pubkey))
}

#[actix_web::main]
async fn main()->std::io::Result<()> {
    dotenv::dotenv().ok();

    println!("Initializing Qcash Faucet");

    let key_str = std::env::var("FAUCET_KEY").expect("FAUCET_KEY must be set in .env");
    let key_bytes:Vec<u8> = serde_json::from_str(&key_str).expect("Invalid JSON in the FAUCET_KEY");
    let authority = Keypair::from_base58_string(&key_str);

    let authority =Arc::new(authority);
    let pubkey = authority.pubkey();

    let client = Client::new(Cluster::Localnet, authority.clone());
    let client = Arc::new(client);

    println!("✅ Authority Loaded: {}", pubkey);

    let state = web::Data::new(AppState{
        authority,
        client
    });


    HttpServer::new(||{
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

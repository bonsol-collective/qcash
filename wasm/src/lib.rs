use qcash_core::wallet::WalletKeys;
use qcash_core::{KYBER_PUBKEY_SIZE};
use serde::Serialize;
use wasm_bindgen::prelude::*;
use pqc_kyber::encapsulate as pqc_encapsulate; 
use rand::rngs::OsRng;
use rand::RngCore;
use chacha20poly1305::{ChaCha20Poly1305, Key, KeyInit, Nonce, aead::{Aead}};
use qcash_core::UTXOEncryptedPayload;

#[wasm_bindgen]
pub fn init_panic_hook(){
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct EncapResult{
    #[wasm_bindgen(getter_with_clone)]
    pub ciphertext:Vec<u8>,
    #[wasm_bindgen(getter_with_clone)]
    pub shared_secret:Vec<u8>,
}

#[wasm_bindgen]
pub fn encapsulate(pubkey_bytes:&[u8])->Result<EncapResult,String>{
    if pubkey_bytes.len() != KYBER_PUBKEY_SIZE{
        return Err("Invalid Public Key Size".to_string());
    }

    // convert slice to fixed array 
    let mut receiver_array = [0u8;KYBER_PUBKEY_SIZE];
    receiver_array.copy_from_slice(pubkey_bytes);

    // Generate Randomness
    let mut rng = OsRng;

    match pqc_encapsulate(&receiver_array, &mut rng) {
        Ok((ciphertext, shared_secret)) => {
            Ok(EncapResult {
                ciphertext: ciphertext.to_vec(),
                shared_secret: shared_secret.to_vec()
            })
        },
        Err(_) => Err("Encapsulation Failed".to_string())
    }
}

#[wasm_bindgen]
pub struct EncryptedPayloadResult{
    #[wasm_bindgen(getter_with_clone)]
    pub encrypted_payload:Vec<u8>,
    #[wasm_bindgen(getter_with_clone)]
    pub nonce:Vec<u8>,
}

#[wasm_bindgen]
pub fn encrypt_payload(shared_secret:&[u8],receiver_vault_bytes:&[u8],amount:u64)->Result<EncryptedPayloadResult,String>{
    if shared_secret.len() != 32 {
        return Err("Invalid Shared Secret Size".to_string());
    }

    if receiver_vault_bytes.len() != 32 {
        return Err("Invalid Receiver Vault Size".to_string());
    }

    let mut receiver_array = [0u8; 32];
    receiver_array.copy_from_slice(receiver_vault_bytes);

    let mut rng = OsRng;
    let mut payload_randomness = [0u8;32];
    rng.try_fill_bytes(&mut payload_randomness).expect("Error filling bytes");

    let utxo_payload = UTXOEncryptedPayload {
        amount,
        is_return: false,
        receiver_vault: receiver_array,
        randomness: payload_randomness,
        utxo_spent_list: vec![],
        version: 1,
    };

    let payload_bytes = bincode::serialize(&utxo_payload)
        .map_err(|e| format!("Serialization Failed : {}",e))?;

    let key = Key::from_slice(shared_secret);
    let cipher = ChaCha20Poly1305::new(key);
    
    let mut nonce_bytes = [0u8; 12];
    rng.try_fill_bytes(&mut  nonce_bytes).expect("Error filling bytes");


    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted_payload = cipher.encrypt(nonce, payload_bytes.as_ref())
        .map_err(|_| "Symmetric Encryption Failed".to_string())?;

    Ok(EncryptedPayloadResult {
        encrypted_payload,
        nonce: nonce_bytes.to_vec()
    })
}

#[derive(Serialize)]
pub struct WalletResult{
    pub mnemonic: String,
    pub solana_address:String,
    pub kyber_pubkey:String,
    pub secret_entropy_hex:String, // 32 bytes hex
}

#[wasm_bindgen]
pub fn generate_wallet()->JsValue{
    let keys = WalletKeys::new();

    let result = WalletResult{
        mnemonic: keys.mnemonic.clone(),
        solana_address: keys.get_solana_address(),
        kyber_pubkey: bs58::encode(keys.kyber_key.public).into_string(),
        secret_entropy_hex: hex::encode(keys.secret_entropy),
    };

    // Serialize to JS Object
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen]
pub fn restore_wallet(mnemonic:&str)->Result<JsValue,String>{

    let keys = std::panic::catch_unwind(||{
        WalletKeys::from_mnemonic(mnemonic)
    }).map_err(|_| "Invalid Mnemonic Phrase".to_string())?;

    let result = WalletResult{
        mnemonic:keys.mnemonic.clone(),
        solana_address:keys.get_solana_address(),
        kyber_pubkey:bs58::encode(keys.kyber_key.public).into_string(),
        secret_entropy_hex:hex::encode(keys.secret_entropy),
    };

    Ok(serde_wasm_bindgen::to_value(&result).unwrap())
}


#[wasm_bindgen]
pub fn get_solana_secret(mnemonic:&str)->Result<Vec<u8>,String>{
    let keys = std::panic::catch_unwind(||{
        WalletKeys::from_mnemonic(mnemonic)
    }).map_err(|_| "Invalid Mnemonic Phrase".to_string())?;

    Ok(keys.solana_key.to_keypair_bytes().to_vec())
}

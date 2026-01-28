use qcash_core::wallet::WalletKeys;
use qcash_core::{KYBER_PUBKEY_SIZE,KYBER_CIPHERTEXT_SIZE};
use serde::Serialize;
use wasm_bindgen::prelude::*;
use pqc_kyber::{encapsulate as pqc_encapsulate,decapsulate as pqc_decapsulate}; 
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
    #[wasm_bindgen(getter_with_clone)]
    pub randomness:Vec<u8>,
}

#[wasm_bindgen]
pub fn encrypt_payload(
    shared_secret:&[u8],
    receiver_vault_bytes:&[u8],
    amount:u64,
    is_return:bool, // true for change 
)->Result<EncryptedPayloadResult,String>{
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
        is_return,
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
        nonce: nonce_bytes.to_vec(),
        randomness:payload_randomness.to_vec(),
    })
}

#[wasm_bindgen]
pub struct DecryptUtxo{
    pub amount: u64,
    #[wasm_bindgen(getter_with_clone)]
    pub randomness: Vec<u8>,
    pub is_return:bool,
    pub index:u32, // helps frontend track position
}

#[wasm_bindgen]
pub fn try_decrypt_utxo(
    secret_key_bytes:&[u8],
    ciphertext:&[u8], //1088 bytes
    nonce:&[u8],
    encrypted_payload:&[u8],
    index:u32, // index in the ledger array
)->Result<DecryptUtxo,String>{
    if ciphertext.len() != KYBER_CIPHERTEXT_SIZE {
        return Err("Invalid Ciphertext Size".into());
    };

    // getting the shared secret 
    // If this fails, the ciphertext was not encrypted for our Public Key.
    let shared_secret = match pqc_decapsulate(ciphertext,secret_key_bytes){
        Ok(s)=> s,
        Err(_)=> return Err("Decapsulation Failed".into()),
    };

    // attempting decryption
    let key = Key::from_slice(&shared_secret);
    let cipher = ChaCha20Poly1305::new(key);
    let nonce_obj = Nonce::from_slice(nonce);

    // If decryption failed that means utxo is not for us
    let decrypted_bytes = match cipher.decrypt(nonce_obj, encrypted_payload){
        Ok(decrypted_bytes) =>decrypted_bytes,
        Err(_)=> return Err("Not our UTXO(Decryption Failed)".into())
    };

    // Deserialize the payload 
    let payload:UTXOEncryptedPayload = bincode::deserialize(&decrypted_bytes)
        .map_err(|_| "Deserializtaion Failed".to_string())?;

    Ok(DecryptUtxo { 
        amount: payload.amount, 
        randomness: payload.randomness.to_vec(), 
        is_return:  payload.is_return,
        index,
    })

}

#[derive(Serialize)]
pub struct WalletResult{
    pub mnemonic: String,
    pub solana_address:String,
    pub kyber_pubkey:String,
    pub kyber_secret_key: Vec<u8>,  // For background sync
    pub secret_entropy_hex:String, // 32 bytes hex
}

#[wasm_bindgen]
pub fn generate_wallet()->JsValue{
    let keys = WalletKeys::new();

    let result = WalletResult{
        mnemonic: keys.mnemonic.clone(),
        solana_address: keys.get_solana_address(),
        kyber_pubkey: bs58::encode(keys.kyber_key.public).into_string(),
        kyber_secret_key: keys.kyber_key.secret.to_vec(),
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
        kyber_secret_key: keys.kyber_key.secret.to_vec(),
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
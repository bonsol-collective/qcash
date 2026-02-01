// Business Source License 1.1 (BSL 1.1)
// Licensor: Bonsol Labs
// Licensed Work: QCash
// Change Date: 2030-12-31
// Change License: Apache License 2.0
// Use of this software is governed by the LICENSE file.

use qcash_core::wallet::WalletKeys;
use qcash_core::{KYBER_PUBKEY_SIZE,KYBER_CIPHERTEXT_SIZE};
use serde::Serialize;
use wasm_bindgen::prelude::*;
use pqc_kyber::{encapsulate as pqc_encapsulate,decapsulate as pqc_decapsulate}; 
use rand::rngs::OsRng;
use rand::RngCore;
use chacha20poly1305::{ChaCha20Poly1305, Key, KeyInit, Nonce, aead::{Aead}};
use qcash_core::UTXOEncryptedPayload;
use sha2::{Sha256, Digest};

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
    #[wasm_bindgen(getter_with_clone)]
    pub utxo_spent_list: Vec<u8>, // Flattened array,
    pub spent_list_len:usize, // to help reconstruct chunks of 32 bytes
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

    let mut flat_spent_list = Vec::new();
    for hash in &payload.utxo_spent_list{
        flat_spent_list.extend_from_slice(hash);
    }

    Ok(DecryptUtxo { 
        amount: payload.amount, 
        randomness: payload.randomness.to_vec(), 
        is_return:  payload.is_return,
        index,
        utxo_spent_list: flat_spent_list,
        spent_list_len: payload.utxo_spent_list.len(),
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

#[derive(Serialize)]
pub struct OutputResult{
    // For Solana Transaction
    pub utxo_hash:Vec<u8>,
    pub prev_utxo_hash:Vec<u8>,
    pub ciphertext_commitment:Vec<u8>,
    pub epoch: u32,
    pub kyber_ciphertext:Vec<u8>,
    pub nonce:Vec<u8>,
    pub encrypted_payload:Vec<u8>,

    // For prover inputs 
    pub randomness:Vec<u8>,
    pub receiver_vault:Vec<u8>,
    pub is_return:bool,
}

// Helper to replicate the guest hashing logic 
pub fn hash_payload_internal(payload:&UTXOEncryptedPayload)->[u8;32]{
    let mut hasher = Sha256::new();
    hasher.update(payload.amount.to_le_bytes());
    hasher.update(&[payload.is_return as u8]);
    hasher.update(payload.receiver_vault);
    hasher.update(payload.randomness);
    for h in &payload.utxo_spent_list{
        hasher.update(h);
    }
    hasher.finalize().into()
}

#[wasm_bindgen]
pub fn prepare_output(
    receiver_pubkey_bytes:&[u8],
    receiver_vault_pda: &[u8],  // The vault PDA address (32 bytes)
    amount:u64,
    prev_utxo_hash_bytes:&[u8],
    epoch:u32,
    is_return:bool,
)->Result<JsValue,String>{
    if receiver_pubkey_bytes.len() != KYBER_PUBKEY_SIZE {
        return Err("Invalid Pubkey Size".into());
    }

    if receiver_vault_pda.len() != 32 {
        return Err("Invalid Vault PDA Size (expected 32 bytes)".into());
    }

    let mut pubkey_arr = [0u8; KYBER_PUBKEY_SIZE];
    pubkey_arr.copy_from_slice(receiver_pubkey_bytes);

    let mut vault_pda_arr = [0u8; 32];
    vault_pda_arr.copy_from_slice(receiver_vault_pda);

    // Kyber Encapsulate
    let mut rng = OsRng;
    let (ciphertext, shared_secret) = match pqc_encapsulate(&pubkey_arr, &mut rng) {
        Ok(res) => res,
        Err(_) => return Err("Encapsulation Failed".into()),
    };

    let mut payload_randomness = [0u8; 32];
    rng.try_fill_bytes(&mut payload_randomness).expect("RNG Error");

    let payload = UTXOEncryptedPayload {
        amount,
        is_return,
        receiver_vault: vault_pda_arr,
        randomness: payload_randomness,
        utxo_spent_list: vec![], // TODO: Add history 
        version: 1,
    };

    let c_commitment = hash_payload_internal(&payload);

    // calculating UTXO hash 
    let mut header_hasher = Sha256::new();
    header_hasher.update(c_commitment);
    header_hasher.update(prev_utxo_hash_bytes);
    header_hasher.update(epoch.to_le_bytes());
    let utxo_hash : [u8;32] = header_hasher.finalize().into();

    // Payload encryption
    let payload_bytes = bincode::serialize(&payload).map_err(|e| e.to_string())?;
    let key = Key::from_slice(&shared_secret);
    let cipher = ChaCha20Poly1305::new(key);

    let mut nonce_bytes = [0u8; 12];
    rng.try_fill_bytes(&mut nonce_bytes).expect("RNG Error");
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted_payload = cipher.encrypt(nonce, payload_bytes.as_ref())
        .map_err(|_| "Encryption Failed".to_string())?;

    let result = OutputResult {
        utxo_hash: utxo_hash.to_vec(),
        prev_utxo_hash: prev_utxo_hash_bytes.to_vec(),
        ciphertext_commitment: c_commitment.to_vec(),
        epoch,
        kyber_ciphertext: ciphertext.to_vec(),
        nonce: nonce_bytes.to_vec(),
        encrypted_payload,
        
        randomness: payload_randomness.to_vec(),
        receiver_vault: vault_pda_arr.to_vec(),
        is_return,
    };

    Ok(serde_wasm_bindgen::to_value(&result).unwrap())
    
}
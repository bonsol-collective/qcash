use qcash_core::wallet::WalletKeys;
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn init_panic_hook(){
    console_error_panic_hook::set_once();
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

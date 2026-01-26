use anchor_lang::prelude::*;

use crate::KYBER_CIPHERTEXT_SIZE;

pub const MAX_PAYLOAD_SIZE:usize = 2048;
pub const NONCE_SIZE:usize = 12; // ChaCha20 Nonce

#[account]
pub struct Ledger{
    pub count: u64,
    pub utxos:Vec<Utxo>,
}

impl Ledger{
    // helper to get the tip for chaining validation
    pub fn get_tip_hash(&self)->[u8;32]{
        if let Some(last) = self.utxos.last(){
            last.utxo_hash
        }else{
            // genesis hash
            [0u8;32]
        }
    }
}

#[derive(AnchorDeserialize,AnchorSerialize,Clone,InitSpace)]
pub struct Utxo{
    pub epoch:u32,
    pub utxo_hash: [u8;32],
    pub prev_utxo_hash: [u8;32],
    pub ciphertext_commitment: [u8;32], // SHA256(ciphertext+payload+nonce)
    pub nonce: [u8;NONCE_SIZE],   // Required by ChaCha20 to decrypt safely, the lock's unique IV
    #[max_len(MAX_PAYLOAD_SIZE)]
    pub encrypted_payload:Vec<u8>,
    pub kyber_ciphertext:[u8;KYBER_CIPHERTEXT_SIZE], // receiver uses this to decrypt the Shared secret
}

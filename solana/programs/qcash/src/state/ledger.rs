use anchor_lang::prelude::*;

pub const MAX_PAYLOAD_SIZE:usize = 2048;

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
    // uniquely identify this utxo
    pub utxo_hash:[u8;32],
    // this must be equal to the previous utxo hash in the chain
    pub prev_utxo_hash:[u8;32],
    pub ciphertext_commitment:[u8;32],
    pub epoch:u32,
    #[max_len(MAX_PAYLOAD_SIZE)]
    pub encrypted_payload:Vec<u8>,
}

use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Vault{
    pub version: u8,
    pub flags: u8,
    #[max_len(1184)]
    pub kyber_pubkey: Vec<u8>, // 1184 bytes + 4 bytes prefix
}


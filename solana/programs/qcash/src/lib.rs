pub mod constants;
pub mod error;
pub mod handlers;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use handlers::*;
pub use state::*;

declare_id!("GS28r8XX2QjJRgMx93vogFotJzzX4C1Gqo8cE4S4bQ1k");

#[program]
pub mod solana_programs {
    use super::*;

    pub fn init_vault(ctx: Context<InitVault>, key_hash: [u8; 32], kyber_key_part1: Vec<u8>) -> Result<()> {
        init_vault::init_vault(ctx, key_hash, kyber_key_part1)
    }

    pub fn complete_vault(ctx: Context<CompleteVault>, kyber_key_part2: Vec<u8>) -> Result<()> {
        complete_vault::complete_vault(ctx, kyber_key_part2)
    }

    pub fn init_ledger(ctx: Context<InitLedger>) -> Result<()> {
        init_ledger::init_ledger(ctx)
    }

    pub fn append_to_ledger(ctx: Context<AppendLedger>, utxo: Utxo) -> Result<()> {
        append_to_ledger::append_to_ledger(ctx, utxo)
    }

    pub fn upload_ciphertext(ctx: Context<UploadCipherText>, ciphertext: [u8; 1088]) -> Result<()> {
        upload_ciphertext::upload_ciphertext(ctx, ciphertext)
    }

    pub fn transfer(ctx: Context<Transfer>, encrypted_payload: Vec<u8>, nonce: [u8; 12]) -> Result<()> {
        transfer::transfer(ctx, encrypted_payload, nonce)
    }
}

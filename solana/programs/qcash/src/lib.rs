pub mod constants;
pub mod error;
pub mod handlers;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use handlers::*;
pub use state::*;

declare_id!("DMiW8pL1vuaRSG367zDRRkSmQM8z5kKUGU3eC9t7AFDT");

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

    pub fn init_loader(ctx: Context<InitLoader>) -> Result<()> {
        upload_ciphertext::init_loader(ctx)
    }

    pub fn write_loader(ctx: Context<WriteLoader>, offset: u32, data: Vec<u8>) -> Result<()> {
        upload_ciphertext::write_loader(ctx, offset, data)
    }

    pub fn init_zk_proof(ctx: Context<InitZkProof>, total_bytes: u32) -> Result<()> {
        upload_zk_proof::init_zk_proof(ctx, total_bytes)
    }

    pub fn write_zk_proof(ctx: Context<WriteZkProof>, offset: u32, chunk: Vec<u8>) -> Result<()> {
        upload_zk_proof::write_zk_proof(ctx, offset, chunk)
    }

    pub fn transfer(ctx: Context<Transfer>, encrypted_payload: Vec<u8>, nonce: [u8; 12]) -> Result<()> {
        transfer::transfer(ctx, encrypted_payload, nonce)
    }
}

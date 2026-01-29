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

    /// Initialize the program with admin authority
    pub fn init_program(ctx: Context<InitProgram>) -> Result<()> {
        init_program::init_program(ctx)
    }

    /// Initialize vault with first part of Kyber public key
    pub fn init_vault(
        ctx: Context<InitVault>,
        key_hash: [u8; 32],
        kyber_key_part1: Vec<u8>,
    ) -> Result<()> {
        init_vault::init_vault(ctx, key_hash, kyber_key_part1)
    }

    /// Complete vault with second part of Kyber public key
    pub fn complete_vault(ctx: Context<CompleteVault>, kyber_key_part2: Vec<u8>) -> Result<()> {
        complete_vault::complete_vault(ctx, kyber_key_part2)
    }

    /// Initialize the ledger
    pub fn init_ledger(ctx: Context<InitLedger>) -> Result<()> {
        init_ledger::init_ledger(ctx)
    }

    // pub fn append_to_ledger(ctx: Context<AppendLedger>, utxo: Utxo) -> Result<()> {
    //     append_to_ledger::append_to_ledger(ctx, utxo)
    // }

    pub fn init_loader(ctx: Context<InitLoader>) -> Result<()> {
        upload_ciphertext::init_loader(ctx)
    }

    /// Write chunk to loader
    pub fn write_loader(ctx: Context<WriteLoader>, offset: u32, data: Vec<u8>) -> Result<()> {
        upload_ciphertext::write_loader(ctx, offset, data)
    }

    /// Initialize ZK proof account
    pub fn init_zk_proof(ctx: Context<InitZkProof>, total_bytes: u32) -> Result<()> {
        upload_zk_proof::init_zk_proof(ctx, total_bytes)
    }

    /// Write chunk to ZK proof
    pub fn write_zk_proof(ctx: Context<WriteZkProof>, offset: u32, chunk: Vec<u8>) -> Result<()> {
        upload_zk_proof::write_zk_proof(ctx, offset, chunk)
    }

    // pub fn transfer(ctx: Context<Transfer>, encrypted_payload: Vec<u8>, nonce: [u8; 12]) -> Result<()> {
    //     transfer::transfer(ctx, encrypted_payload, nonce)
    // }

    pub fn create_utxo(
        ctx: Context<CreateUtxo>,
        utxo_hash: [u8; 32],
        encrypted_payload: Vec<u8>,
        nonce: [u8; 12],
        epoch: u32,
    ) -> Result<()> {
        create_utxo::create_utxo(ctx, utxo_hash, encrypted_payload, nonce, epoch)
    }

    /// Register a new prover (admin only)
    pub fn register_prover(ctx: Context<RegisterProver>, unique_id: u64) -> Result<()> {
        register_prover::register_prover(ctx, unique_id)
    }

    /// Deactivate a prover (admin only)
    pub fn deactivate_prover(ctx: Context<DeactivateProver>) -> Result<()> {
        deactivate_prover::deactivate_prover(ctx)
    }

    /// Submit attestation vote on a UTXO
    pub fn submit_attestation(
        ctx: Context<SubmitAttestation>,
        utxo_hash: [u8; 32],
        vote: bool,
        next_key_hash: [u8; 32],
    ) -> Result<()> {
        submit_attestation::submit_attestation(ctx, utxo_hash, vote, next_key_hash)
    }
}

use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::events::AirdropCompleted;
use crate::state::{Utxo, Ledger, Loader};

/// Airdrop instruction - creates a UTXO without proof verification
/// This is used by the faucet to distribute tokens without going through
/// the full ZK proof and attestation flow.
/// Security Note: This bypasses proof verification and immediately finalizes.
/// The ciphertext_commitment must be pre-calculated by the faucet to match
/// the prover's verification logic (hash of plaintext payload fields).
#[derive(Accounts)]
#[instruction(utxo_hash: [u8; 32], encrypted_payload: Vec<u8>)]
pub struct Airdrop<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [LEDGER_SEED],
        bump = ledger.bump,
    )]
    pub ledger: Box<Account<'info, Ledger>>,

    /// New UTXO account to be created
    /// Uses same UTXO_SEED as regular UTXOs - differentiated by optional voting fields
    #[account(
        init,
        payer = signer,
        space = Utxo::size_airdrop(encrypted_payload.len()),
        seeds = [UTXO_SEED, utxo_hash.as_ref()],
        bump,
    )]
    pub utxo: Box<Account<'info, Utxo>>,

    /// Loader account containing Kyber ciphertext (will be closed after use)
    #[account(
        mut,
        close = signer,
        constraint = loader.ciphertext.len() == KYBER_CIPHERTEXT_SIZE
    )]
    pub loader: Box<Account<'info, Loader>>,

    pub system_program: Program<'info, System>,
}

pub fn airdrop(
    ctx: Context<Airdrop>,
    utxo_hash: [u8; 32],
    encrypted_payload: Vec<u8>,
    nonce: [u8; NONCE_SIZE],
    ciphertext_commitment: [u8; 32],
    epoch: u32,
) -> Result<()> {
    let ledger = &mut ctx.accounts.ledger;
    let loader = &ctx.accounts.loader;
    let utxo_key = ctx.accounts.utxo.key();
    let utxo = &mut ctx.accounts.utxo;
    let bump = ctx.bumps.utxo;

    let prev_utxo_hash = ledger.get_tip_hash();

    // Verify payload size
    require!(
        encrypted_payload.len() <= MAX_PAYLOAD_SIZE,
        ErrorCode::PayloadTooLarge
    );

    // Initialize UTXO without voting (airdrop flow)
    // Note: ciphertext_commitment is provided by the faucet and should be
    // the hash of the plaintext payload fields to match prover verification
    utxo.initialize_airdrop(
        epoch,
        utxo_hash,
        prev_utxo_hash,
        ciphertext_commitment,
        nonce,
        encrypted_payload,
        loader.ciphertext,
        bump,
    );

    // Immediately update ledger tip (no attestation required for airdrop)
    ledger.update_tip(utxo_hash);

    // Emit event
    emit!(AirdropCompleted {
        utxo: utxo_key,
        utxo_hash,
        prev_utxo_hash,
        epoch,
        payload_size: utxo.encrypted_payload.len() as u32,
        ciphertext_commitment,
        bump,
        new_ledger_count: ledger.count,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}


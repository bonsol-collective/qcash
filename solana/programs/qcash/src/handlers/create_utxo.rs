use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::events::UtxoCreated;
use crate::state::{Utxo, Ledger, Loader};

#[derive(Accounts)]
#[instruction(utxo_hash: [u8; 32], encrypted_payload: Vec<u8>)]
pub struct CreateUtxo<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    /// Ledger account to verify previous UTXO hash
    #[account(
        seeds = [LEDGER_SEED],
        bump = ledger.bump,
    )]
    pub ledger: Box<Account<'info, Ledger>>,

    /// New UTXO account to be created
    /// PDA: ["utxo", utxo_hash]
    #[account(
        init,
        payer = signer,
        space = Utxo::size(encrypted_payload.len()),
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

    /// ZK Proof account reference
    /// CHECK: Just storing the pubkey reference, not accessing data
    pub zk_proof: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_utxo(
    ctx: Context<CreateUtxo>,
    utxo_hash: [u8; 32],
    encrypted_payload: Vec<u8>,
    nonce: [u8; NONCE_SIZE],
    epoch: u32,
) -> Result<()> {
    let ledger = &ctx.accounts.ledger;
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

    // Calculate ciphertext commitment on heap
    let commitment_data = {
        let mut data = Vec::with_capacity(
            KYBER_CIPHERTEXT_SIZE + NONCE_SIZE + encrypted_payload.len()
        );
        data.extend_from_slice(&loader.ciphertext);
        data.extend_from_slice(&nonce);
        data.extend_from_slice(&encrypted_payload);
        data
    };
    let ciphertext_commitment = hash(&commitment_data).to_bytes();

    // Initialize UTXO
    utxo.initialize(
        epoch,
        utxo_hash,
        prev_utxo_hash,
        ciphertext_commitment,
        nonce,
        encrypted_payload,
        loader.ciphertext,
        ctx.accounts.zk_proof.key(),
        bump,
    );

    // Emit event
    emit!(UtxoCreated {
        utxo: utxo_key,
        utxo_hash,
        prev_utxo_hash,
        epoch,
        payload_size: utxo.encrypted_payload.len() as u32,
        zk_proof: ctx.accounts.zk_proof.key(),
        ciphertext_commitment,
        bump,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

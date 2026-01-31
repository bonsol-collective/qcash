use anchor_lang::prelude::*;
use anchor_lang::system_program;
use solana_sha256_hasher::hash;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::events::AttestationSubmitted;
use crate::state::{Utxo, Ledger, ProverRegistry};

#[derive(Accounts)]
#[instruction(utxo_hash: [u8; 32])]
pub struct SubmitAttestation<'info> {
    /// The old prover account that will be used to pay for this IX.
    /// Afterwards, all the remaining lamports will be transferred to the new prover account.
    #[account(mut)]
    pub prover_old: Signer<'info>,

    /// The new prover submitting their vote
    /// Their public key will be hashed and checked against the registry
    /// This becomes the active prover account after key rotation
    #[account(mut)]
    pub prover: Signer<'info>,

    /// Ledger to verify and update
    #[account(
        mut,
        seeds = [LEDGER_SEED],
        bump = ledger.bump,
    )]
    pub ledger: Box<Account<'info, Ledger>>,

    /// UTXO being attested
    #[account(
        mut,
        seeds = [UTXO_SEED, utxo_hash.as_ref()],
        bump = utxo.bump,
    )]
    pub utxo: Box<Account<'info, Utxo>>,

    /// Prover registry
    #[account(
        mut,
        seeds = [PROVER_REGISTRY_SEED],
        bump = prover_registry.bump,
    )]
    pub prover_registry: Box<Account<'info, ProverRegistry>>,

    pub system_program: Program<'info, System>,
}

pub fn submit_attestation(
    ctx: Context<SubmitAttestation>,
    _utxo_hash: [u8; 32],
    vote: bool,
    next_key_hash: [u8; 32],
) -> Result<()> {
    let ledger = &mut ctx.accounts.ledger;
    let utxo_key = ctx.accounts.utxo.key();
    let utxo = &mut ctx.accounts.utxo;
    let prover_registry = &mut ctx.accounts.prover_registry;
    let prover_pubkey = ctx.accounts.prover.key();

    // Verify UTXO's previous hash matches ledger's last valid hash
    require!(
        utxo.prev_utxo_hash == ledger.get_tip_hash(),
        ErrorCode::UtxoHashMismatch
    );

    // Hash OLD prover's public key for verification
    let prover_pubkey_hash = hash(prover_pubkey.as_ref()).to_bytes();

    // Get prover from registry using OLD pubkey hash
    let prover_info = prover_registry.get_prover_mut(&prover_pubkey_hash)?;

    // Verify prover is active
    require!(prover_info.is_active(), ErrorCode::ProverNotActive);

    let prover_unique_id = prover_info.unique_id;

    // Record vote on UTXO
    utxo.record_vote(prover_unique_id, vote)?;

    // Update prover's key hash to the next_key_hash for rotation
    prover_info.update_pubkey_hash(next_key_hash);

    // Transfer all lamports from old prover account to new prover account
    let old_lamports = ctx.accounts.prover_old.lamports();
    if old_lamports > 0 {
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.prover_old.to_account_info(),
            to: ctx.accounts.prover.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_ix
        );
        system_program::transfer(cpi_ctx, old_lamports)?;
    }

    // Check if minimum attestations threshold is met
    let threshold_met = utxo.threshold_met(MIN_ATTESTATIONS_REQUIRED);
    let (new_ledger_tip, new_ledger_count) = if threshold_met {
        // Update ledger with new valid UTXO
        ledger.update_tip(utxo.utxo_hash);
        (Some(utxo.utxo_hash), Some(ledger.count))
    } else {
        (None, None)
    };

    // Emit event
    emit!(AttestationSubmitted {
        utxo: utxo_key,
        utxo_hash: utxo.utxo_hash,
        prover_old: ctx.accounts.prover_old.key(),
        prover: prover_pubkey,
        prover_unique_id,
        vote,
        next_key_hash,
        lamports_transferred: old_lamports,
        valid_votes: utxo.get_valid_votes(),
        invalid_votes: utxo.get_invalid_votes(),
        total_votes: utxo.get_total_votes(),
        threshold_met,
        new_ledger_tip,
        new_ledger_count,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

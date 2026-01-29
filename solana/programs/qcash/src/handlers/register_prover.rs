use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::events::ProverRegistered;
use crate::state::{ProgramConfig, ProverRegistry};

#[derive(Accounts)]
pub struct RegisterProver<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Program configuration
    #[account(
        seeds = [PROGRAM_CONFIG_SEED],
        bump = program_config.bump,
        constraint = program_config.is_admin(&admin.key()) @ ErrorCode::UnauthorizedAdmin,
    )]
    pub program_config: Box<Account<'info, ProgramConfig>>,

    /// Prover registry
    #[account(
        mut,
        seeds = [PROVER_REGISTRY_SEED],
        bump = prover_registry.bump,
    )]
    pub prover_registry: Box<Account<'info, ProverRegistry>>,

    /// Prover's public key to register
    /// CHECK: We only hash this pubkey, don't need to validate
    pub prover_pubkey: AccountInfo<'info>,
}

pub fn register_prover(
    ctx: Context<RegisterProver>,
    unique_id: u64,
) -> Result<()> {
    let prover_registry = &mut ctx.accounts.prover_registry;
    let prover_pubkey = ctx.accounts.prover_pubkey.key();

    // Hash the prover's public key
    let prover_pubkey_hash = hash(prover_pubkey.as_ref()).to_bytes();

    // Register the prover
    prover_registry.register_prover(unique_id, prover_pubkey_hash)?;

    // Emit event
    emit!(ProverRegistered {
        admin: ctx.accounts.admin.key(),
        unique_id,
        prover_pubkey,
        prover_pubkey_hash,
        total_provers: prover_registry.prover_count,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

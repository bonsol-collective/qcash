use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{ProgramConfig, ProverRegistry};

#[derive(Accounts)]
pub struct DeactivateProver<'info> {
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

    /// Prover's public key to deactivate
    /// CHECK: We only hash this pubkey, don't need to validate
    pub prover_pubkey: AccountInfo<'info>,
}

pub fn deactivate_prover(ctx: Context<DeactivateProver>) -> Result<()> {
    let prover_registry = &mut ctx.accounts.prover_registry;
    let prover_pubkey = ctx.accounts.prover_pubkey.key();

    // Hash the prover's public key
    let prover_pubkey_hash = hash(prover_pubkey.as_ref()).to_bytes();

    // Deactivate the prover
    prover_registry.deactivate_prover(&prover_pubkey_hash)?;

    msg!(
        "Prover deactivated | Pubkey: {} | Hash: {:?}",
        prover_pubkey,
        prover_pubkey_hash
    );

    Ok(())
}

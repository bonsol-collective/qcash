use anchor_lang::prelude::*;
use crate::constants::*;
use crate::events::ProgramInitialized;
use crate::state::{ProgramConfig, ProverRegistry};

#[derive(Accounts)]
pub struct InitProgram<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Program configuration account
    #[account(
        init,
        payer = admin,
        space = ProgramConfig::SIZE,
        seeds = [PROGRAM_CONFIG_SEED],
        bump,
    )]
    pub program_config: Box<Account<'info, ProgramConfig>>,

    /// Prover registry account
    #[account(
        init,
        payer = admin,
        space = 8 + ProverRegistry::MAX_SIZE,
        seeds = [PROVER_REGISTRY_SEED],
        bump,
    )]
    pub prover_registry: Box<Account<'info, ProverRegistry>>,

    pub system_program: Program<'info, System>,
}

pub fn init_program(ctx: Context<InitProgram>) -> Result<()> {
    let program_config = &mut ctx.accounts.program_config;
    let prover_registry = &mut ctx.accounts.prover_registry;

    let config_bump = ctx.bumps.program_config;
    let registry_bump = ctx.bumps.prover_registry;

    // Initialize program config with admin as the deployer
    program_config.initialize(
        ctx.accounts.admin.key(),
        MIN_ATTESTATIONS_REQUIRED,
        config_bump,
    );

    // Initialize empty prover registry
    prover_registry.initialize(registry_bump);

    // Emit event
    emit!(ProgramInitialized {
        admin: ctx.accounts.admin.key(),
        min_attestations: MIN_ATTESTATIONS_REQUIRED,
        config_bump,
        registry_bump,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::Ledger;

#[derive(Accounts)]
pub struct InitLedger<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = Ledger::SIZE,
        seeds = [LEDGER_SEED],
        bump,
    )]
    pub ledger: Account<'info, Ledger>,

    pub system_program: Program<'info, System>,
}

pub fn init_ledger(ctx: Context<InitLedger>) -> Result<()> {
    let ledger = &mut ctx.accounts.ledger;
    let bump = ctx.bumps.ledger;

    ledger.initialize(bump);

    msg!(
        "Ledger initialized | Count: {} | Genesis hash: {:?} | Bump: {}",
        ledger.count,
        ledger.last_valid_utxo_hash,
        bump
    );

    Ok(())
}

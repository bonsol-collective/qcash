use anchor_lang::prelude::*;

use crate::{Ledger, ledger};

#[derive(Accounts)]
pub struct InitLedger<'info>{

    #[account(mut)]
    pub payer:Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = Ledger::DISCRIMINATOR.len() + 8 + 4, // we start empty
        seeds = [
            b"ledger"
        ],
        bump,
    )]
    pub ledger:Account<'info,Ledger>,

    pub system_program:Program<'info,System>,
}

pub fn init_ledger(ctx:Context<InitLedger>)->Result<()>{

    let ledger = &mut ctx.accounts.ledger;

    ledger.count = 0;
    ledger.utxos = Vec::new();

    msg!("Ledger Initialized");

    Ok(())
}

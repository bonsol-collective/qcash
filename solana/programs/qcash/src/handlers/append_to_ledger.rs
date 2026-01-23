use anchor_lang::prelude::*;

use crate::{Ledger,Utxo,error::ErrorCode};

#[derive(Accounts)]
#[instruction(new_utxo:Utxo)]
pub struct AppendLedger<'info>{
    #[account(mut)]
    pub payer:Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"ledger"
        ],
        bump,
        realloc = ledger.to_account_info().data_len() + Utxo::INIT_SPACE,
        realloc::payer = payer,
        realloc::zero = false
    )]
    pub ledger:Account<'info,Ledger>,

    pub system_program:Program<'info,System>,
}

#[derive(AnchorSerialize,AnchorDeserialize,Clone,InitSpace)]
pub struct StarkProof{
    #[max_len(256)]
    pub proof_data:Vec<u8>,
}

pub fn append_to_ledger(ctx:Context<AppendLedger>,utxo:Utxo)->Result<()>{

    let ledger = &mut ctx.accounts.ledger;

    require!(ledger.get_tip_hash() ==utxo.prev_utxo_hash,ErrorCode::InvalidHashMismatch);

    ledger.utxos.push(utxo);

    ledger.count +=1;

    msg!("UTXO appended to Ledger successfully. Total UTXOs: {}", ledger.count);

    Ok(())
}

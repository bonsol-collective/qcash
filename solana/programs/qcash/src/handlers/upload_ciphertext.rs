use anchor_lang::prelude::*;

use crate::{Loader,error::ErrorCode};

#[derive(Accounts)]
pub struct InitLoader<'info>{

    #[account(mut)]
    pub signer:Signer<'info>,

    #[account(
        init,
        space = Loader::LEN,
        payer = signer,
    )]
    pub loader:Account<'info,Loader>,

    pub system_program: Program<'info,System>,
}

pub fn init_loader(ctx:Context<InitLoader>)->Result<()>{
    msg!("Loader Account Initialized");
    Ok(())
}

#[derive(Accounts)]
pub struct WriteLoader<'info>{
    #[account(mut)]
    pub loader: Account<'info,Loader>,
}

pub fn write_loader(ctx:Context<WriteLoader>,offset:u32,data:Vec<u8>)->Result<()>{
    let loader = &mut ctx.accounts.loader;

    // bound check
    let start = offset as usize;
    let end = start + data.len();
    
    require!(end <= Loader::LEN,ErrorCode::PayloadTooLarge);

    loader.ciphertext[start..end].copy_from_slice(&data);

    msg!("Wrote chunks : {} bytes at offeset {}",data.len(),offset);

    Ok(())
}

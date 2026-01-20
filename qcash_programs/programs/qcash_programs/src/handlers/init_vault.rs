use anchor_lang::prelude::*;

use crate::{Vault,error::ErrorCode};

#[derive(Accounts)]
#[instruction(key_hash:[u8;32])]
pub struct InitVault<'info>{
    #[account(mut)]
    pub signer:Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = Vault::DISCRIMINATOR.len() + Vault::INIT_SPACE,
        seeds = [
            b"vault",
            key_hash.as_ref()
        ],
        bump
    )]
    pub vault: Account<'info,Vault>,

    pub system_program: Program<'info,System>,
}

pub fn init_vault(ctx:Context<InitVault>,_key_hash:[u8;32],kyber_key_part1:Vec<u8>) -> Result<()>{
    require!(kyber_key_part1.len() <= 800, ErrorCode::ChunkSizeExceeded);

    let vault = &mut ctx.accounts.vault;
    vault.version = 1;
    vault.flags = 0;
    vault.kyber_pubkey = kyber_key_part1;

    msg!("Vault Initiaized, Chunk 1/2 stored");

    Ok(())
}

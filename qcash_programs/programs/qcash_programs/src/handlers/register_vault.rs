use anchor_lang::prelude::*;
use crate::{Vault,error::ErrorCode};
use solana_program::keccak;

#[derive(Accounts)]
#[instruction(kyber_pubkey: Vec<u8>, kyber_pubkey_hash: [u8; 32])]
pub struct RegisterVault<'info>{

    #[account(mut)]
    pub signer:Signer<'info>,

    #[account(
        init,
        payer=signer,
        space=Vault::DISCRIMINATOR.len() + Vault::INIT_SPACE + 8,
        seeds=[
            b"vault",
            kyber_pubkey_hash.as_ref()
        ],
        bump,
    )]
    pub vault: Account<'info,Vault>,

    pub system_program:Program<'info,System>,
}

pub fn register_vault(ctx:Context<RegisterVault>,kyber_pubkey:Vec<u8>, kyber_pubkey_hash: [u8; 32])->Result<()>{

    let vault = &mut ctx.accounts.vault;

    require!(kyber_pubkey.len() == 1184, ErrorCode::InvalidKeyLength);

    let computed_hash = keccak::hash(&kyber_pubkey);
    require!(computed_hash.0 == kyber_pubkey_hash, ErrorCode::InvalidKeyLength);

    vault.version = 1;
    vault.kyber_pubkey = kyber_pubkey;
    vault.flags = 0;

    msg!("Vault registered successfully");

    Ok(())
}

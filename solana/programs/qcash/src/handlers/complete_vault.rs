use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;
use crate::{Vault, error::ErrorCode};

#[derive(Accounts)]
pub struct CompleteVault<'info>{
    #[account(mut)]
    pub vault:Account<'info,Vault>,
}

pub fn complete_vault(ctx:Context<CompleteVault>,kyber_key_part2:Vec<u8>) -> Result<()>{
    let vault = &mut ctx.accounts.vault;

    vault.kyber_pubkey.extend(kyber_key_part2);

    // Validate Total length
    require!(vault.kyber_pubkey.len() == 1184, ErrorCode::InvalidKeyLength);

    // hash verification
    let hash_result = hash(&vault.kyber_pubkey);
    let vault_key = vault.key();

    let (derived_pda,_bump) = Pubkey::find_program_address(
        &[b"vault",hash_result.as_ref()],
        ctx.program_id,
    );

    require_keys_eq!(vault_key, derived_pda, ErrorCode::HashMismatch);

    msg!(
        "Vault completed | Full Kyber public key stored | Total size: {} | Hash: {:?}",
        vault.kyber_pubkey.len(),
        hash_result.to_bytes()
    );

    Ok(())
}

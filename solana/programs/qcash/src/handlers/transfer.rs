use anchor_lang::prelude::*;
use solana_program::hash::hash;

use crate::{KYBER_CIPHERTEXT_SIZE, Ledger, Loader, Utxo};

#[derive(Accounts)]
pub struct Transfer<'info>{
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"ledger"
        ],
        bump,
        realloc = ledger.to_account_info().data_len() + Utxo::INIT_SPACE,
        realloc::payer = signer,
        realloc::zero = false,
    )]
    pub ledger: Account<'info,Ledger>,

    // We read from here and close it
    #[account(
        mut,
        close = signer,
        constraint = loader.ciphertext.len() == KYBER_CIPHERTEXT_SIZE
    )]
    pub loader: Account<'info,Loader>,

    pub system_program:Program<'info,System>,
}

pub fn transfer(
    ctx:Context<Transfer>,
    encrypted_payload:Vec<u8>,
    nonce:[u8;12],
    // Proof Data
)->Result<()>{

    let ledger = &mut ctx.accounts.ledger;
    let loader = &ctx.accounts.loader;

    let prev_utxo_hash = ledger.get_tip_hash();

    // calculating ciphertext commitment
    // This fingerprint proves that data hasn't changed without needing to read the data
    let mut commitment_data = Vec::new();
    commitment_data.extend_from_slice(&loader.ciphertext);
    commitment_data.extend_from_slice(&nonce);
    commitment_data.extend_from_slice(&encrypted_payload);

    let ciphertext_commitment = hash(&commitment_data).to_bytes();
    // TODO: Hardcoded Epcoh
    let epoch:u32 = 0;

    // calculating Utxo hash
    // Hash(prev_utxo_hash || ciphertext_commitment ||  epoch)
    let mut header_data = Vec::new();
    header_data.extend_from_slice(&prev_utxo_hash);
    header_data.extend_from_slice(&ciphertext_commitment);
    header_data.extend_from_slice(&epoch.to_le_bytes());

    let utxo_hash = hash(&header_data).to_bytes();

    let new_utxo = Utxo{
        kyber_ciphertext: loader.ciphertext,
        encrypted_payload,
        ciphertext_commitment,
        epoch,
        nonce,
        prev_utxo_hash,
        utxo_hash,
    };

    // Append to ledger
    ledger.utxos.push(new_utxo);
    ledger.count+=1;

    msg!("Transfer Finalized. UTXO Hash: {:?}", utxo_hash);

    Ok(())
}

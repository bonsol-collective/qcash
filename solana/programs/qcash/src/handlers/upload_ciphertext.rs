use anchor_lang::prelude::*;

use crate::Loader;

#[derive(Accounts)]
pub struct UploadCipherText<'info>{
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        space = Loader::LEN,
        payer = signer,
    )]
    pub loader: Account<'info,Loader>,

    pub system_program: Program<'info,System>
}


pub fn upload_ciphertext(ctx:Context<UploadCipherText>,cipherText:[u8;1088])->Result<()>{

    let loader_account = &mut ctx.accounts.loader;
    loader_account.ciphertext = cipherText;

    msg!("CipherText uploaded to Loader: {}",loader_account.key());

    Ok(())
}

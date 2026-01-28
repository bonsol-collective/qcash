use anchor_lang::prelude::*;
use crate::{ZkProof, error::ErrorCode};

#[derive(Accounts)]
#[instruction(total_bytes: u32)]
pub struct InitZkProof<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    
    /// CHECK: This account is manually initialized with custom space
    #[account(
        init,
        payer = signer,
        space = 8 + 4 + 4 + total_bytes as usize, // discriminator + total_len + bytes_written + proof_data
    )]
    pub zk_proof: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WriteZkProof<'info> {
    /// CHECK: Account data is validated in the instruction handler
    #[account(mut)]
    pub zk_proof: AccountInfo<'info>,
}

pub fn init_zk_proof(ctx: Context<InitZkProof>, total_bytes: u32) -> Result<()> {
    let zk_proof = &ctx.accounts.zk_proof;
    let mut data = zk_proof.try_borrow_mut_data()?;
    
    ZkProof::initialize(&mut data, total_bytes);
    
    msg!("ZK Proof Account Initialized: {} bytes", total_bytes);
    Ok(())
}

pub fn write_zk_proof(ctx: Context<WriteZkProof>, offset: u32, chunk: Vec<u8>) -> Result<()> {
    let zk_proof = &ctx.accounts.zk_proof;
    let mut data = zk_proof.try_borrow_mut_data()?;
    
    // Read current state
    let total_len = ZkProof::read_total_len(&data);
    let bytes_written = ZkProof::read_bytes_written(&data);
    
    // Validate offset matches current bytes_written
    require!(
        offset == bytes_written,
        ErrorCode::InvalidOffset
    );
    
    // Calculate end position
    let start = offset as usize;
    let end = start
        .checked_add(chunk.len())
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    // Validate bounds
    require!(
        end <= total_len as usize,
        ErrorCode::PayloadTooLarge
    );
    
    // Write chunk
    ZkProof::write_chunk(&mut data, bytes_written, &chunk);
    
    // Update bytes_written
    let new_bytes_written = bytes_written
        .checked_add(chunk.len() as u32)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    ZkProof::update_bytes_written(&mut data, new_bytes_written);
    
    msg!(
        "Wrote chunk: {} bytes at offset {} ({}/{})",
        chunk.len(),
        offset,
        new_bytes_written,
        total_len
    );
    
    Ok(())
}

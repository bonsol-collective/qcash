use anchor_lang::prelude::*;
use crate::{ZkProof, error::ErrorCode};
use crate::events::{ZkProofInitialized, ZkProofChunkWritten};

#[derive(Accounts)]
#[instruction(total_bytes: u32)]
pub struct InitZkProof<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    
    /// CHECK: Account is pre-created by client via System Program to bypass 10KB CPI limit.
    /// We just initialize the data structure here.
    #[account(
        mut,
        owner = crate::ID,
    )]
    pub zk_proof: AccountInfo<'info>,
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
    
    emit!(ZkProofInitialized {
        zk_proof: zk_proof.key(),
        total_bytes,
        timestamp: Clock::get()?.unix_timestamp,
    });

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
    
    emit!(ZkProofChunkWritten {
        zk_proof: zk_proof.key(),
        chunk_size: chunk.len() as u32,
        offset,
        new_bytes_written,
        total_length: total_len,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

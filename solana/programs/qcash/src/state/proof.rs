use crate::error::ErrorCode;
use anchor_lang::prelude::*;

pub struct ZkProof {
    pub total_len: u32,
    pub bytes_written: u32,
    // NOTE: Actual proof bytes follow this header in the account data
}

impl ZkProof {
    pub const HEADER_SIZE: usize = 8 + // discriminator
        4 + // total_len
        4; // bytes_written
    
    // Field offsets (absolute, including discriminator)
    const TOTAL_LEN_OFFSET: usize = 8;
    const BYTES_WRITTEN_OFFSET: usize = 12;

    pub fn space(proof_len: u32) -> Result<usize> {
        let space = Self::HEADER_SIZE
            .checked_add(proof_len as usize)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        Ok(space)
    }

    pub fn data_offset() -> usize {
        Self::HEADER_SIZE
    }

    pub fn discriminator() -> [u8; 8] {
        // Custom discriminator for ZkProof
        [99, 112, 199, 152, 247, 109, 47, 105]
    }

    pub fn initialize(data: &mut [u8], total_length: u32) {
        // Write discriminator
        data[0..8].copy_from_slice(&Self::discriminator());

        // Write total_len
        data[Self::TOTAL_LEN_OFFSET..Self::TOTAL_LEN_OFFSET + 4]
            .copy_from_slice(&total_length.to_le_bytes());

        // Write bytes_written (initialized to 0)
        data[Self::BYTES_WRITTEN_OFFSET..Self::BYTES_WRITTEN_OFFSET + 4]
            .copy_from_slice(&0u32.to_le_bytes());
    }

    /// Read total_len from account data
    pub fn read_total_len(data: &[u8]) -> u32 {
        u32::from_le_bytes([
            data[Self::TOTAL_LEN_OFFSET],
            data[Self::TOTAL_LEN_OFFSET + 1],
            data[Self::TOTAL_LEN_OFFSET + 2],
            data[Self::TOTAL_LEN_OFFSET + 3],
        ])
    }

    /// Read bytes_written from account data
    pub fn read_bytes_written(data: &[u8]) -> u32 {
        u32::from_le_bytes([
            data[Self::BYTES_WRITTEN_OFFSET],
            data[Self::BYTES_WRITTEN_OFFSET + 1],
            data[Self::BYTES_WRITTEN_OFFSET + 2],
            data[Self::BYTES_WRITTEN_OFFSET + 3],
        ])
    }

    /// Update bytes_written in account data
    pub fn update_bytes_written(data: &mut [u8], new_bytes_written: u32) {
        data[Self::BYTES_WRITTEN_OFFSET..Self::BYTES_WRITTEN_OFFSET + 4]
            .copy_from_slice(&new_bytes_written.to_le_bytes());
    }

    /// Get proof data slice from account data
    pub fn get_proof_data(data: &[u8], total_length: u32) -> &[u8] {
        let proof_data_offset = Self::data_offset();
        let proof_data_end = proof_data_offset + total_length as usize;
        &data[proof_data_offset..proof_data_end]
    }

    /// Write chunk to account data
    pub fn write_chunk(data: &mut [u8], bytes_written: u32, chunk: &[u8]) {
        let write_offset = Self::data_offset() + bytes_written as usize;
        let chunk_len = chunk.len();
        data[write_offset..write_offset + chunk_len].copy_from_slice(chunk);
    }
}

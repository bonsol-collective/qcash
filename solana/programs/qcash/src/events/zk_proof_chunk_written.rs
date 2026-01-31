//! Event emitted when a chunk is written to the ZK proof
//!
//! This event is emitted after successfully writing a chunk to the ZK proof.

use anchor_lang::prelude::*;

/// Event emitted when a chunk is written to the ZK proof
#[event]
#[derive(Debug)]
pub struct ZkProofChunkWritten {
    /// ZK proof account address
    pub zk_proof: Pubkey,
    /// Chunk size in bytes
    pub chunk_size: u32,
    /// Offset where chunk was written
    pub offset: u32,
    /// New bytes written
    pub new_bytes_written: u32,
    /// Total length
    pub total_length: u32,
    /// Timestamp when written
    pub timestamp: i64,
}

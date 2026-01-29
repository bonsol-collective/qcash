//! Event emitted when a chunk is written to the loader
//!
//! This event is emitted after successfully writing a chunk to the loader.

use anchor_lang::prelude::*;

/// Event emitted when a chunk is written to the loader
#[event]
pub struct LoaderChunkWritten {
    /// Loader account address
    pub loader: Pubkey,
    /// Chunk size in bytes
    pub chunk_size: u32,
    /// Offset where chunk was written
    pub offset: u32,
    /// End position after write
    pub end: u32,
    /// Timestamp when written
    pub timestamp: i64,
}

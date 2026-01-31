//! Event emitted when a ZK proof account is initialized
//!
//! This event is emitted after successfully initializing a ZK proof account.

use anchor_lang::prelude::*;

/// Event emitted when a ZK proof account is initialized
#[event]
#[derive(Debug)]
pub struct ZkProofInitialized {
    /// ZK proof account address
    pub zk_proof: Pubkey,
    /// Total bytes allocated
    pub total_bytes: u32,
    /// Timestamp when initialized
    pub timestamp: i64,
}

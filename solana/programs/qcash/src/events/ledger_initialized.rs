//! Event emitted when the ledger is initialized
//!
//! This event is emitted after successfully initializing the ledger.

use anchor_lang::prelude::*;

/// Event emitted when the ledger is initialized
#[event]
#[derive(Debug)]
pub struct LedgerInitialized {
    /// Initial count (should be 0)
    pub count: u64,
    /// Genesis hash (all zeros)
    pub genesis_hash: [u8; 32],
    /// Ledger PDA bump
    pub bump: u8,
    /// Timestamp when initialized
    pub timestamp: i64,
}

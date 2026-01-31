//! Event emitted when a vault is completed
//!
//! This event is emitted after successfully completing a vault with the full Kyber key.

use anchor_lang::prelude::*;

/// Event emitted when a vault is completed
#[event]
#[derive(Debug)]
pub struct VaultCompleted {
    /// Vault PDA
    pub vault: Pubkey,
    /// Total length of the Kyber public key
    pub total_length: u32,
    /// Hash of the Kyber public key
    pub key_hash: [u8; 32],
    /// Timestamp when completed
    pub timestamp: i64,
}

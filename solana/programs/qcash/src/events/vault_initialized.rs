//! Event emitted when a vault is initialized
//!
//! This event is emitted after successfully initializing a vault with the first part of the Kyber key.

use anchor_lang::prelude::*;

/// Event emitted when a vault is initialized
#[event]
pub struct VaultInitialized {
    /// Owner of the vault
    pub owner: Pubkey,
    /// Vault PDA
    pub vault: Pubkey,
    /// Version of the vault
    pub version: u8,
    /// Length of the first chunk
    pub chunk1_length: u32,
    /// Timestamp when initialized
    pub timestamp: i64,
}

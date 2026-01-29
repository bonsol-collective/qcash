//! Event emitted when a UTXO is created
//!
//! This event is emitted after successfully creating a new UTXO.

use anchor_lang::prelude::*;

/// Event emitted when a UTXO is created
#[event]
pub struct UtxoCreated {
    /// UTXO account PDA
    pub utxo: Pubkey,
    /// UTXO hash
    pub utxo_hash: [u8; 32],
    /// Previous UTXO hash
    pub prev_utxo_hash: [u8; 32],
    /// Epoch number
    pub epoch: u32,
    /// Encrypted payload size
    pub payload_size: u32,
    /// ZK proof reference
    pub zk_proof: Pubkey,
    /// Ciphertext commitment
    pub ciphertext_commitment: [u8; 32],
    /// UTXO PDA bump
    pub bump: u8,
    /// Timestamp when created
    pub timestamp: i64,
}

//! Event emitted when a prover is registered
//!
//! This event is emitted after successfully registering a new prover in the prover registry.

use anchor_lang::prelude::*;

/// Event emitted when a new prover is registered
#[event]
pub struct ProverRegistered {
    /// Admin who registered the prover
    pub admin: Pubkey,
    /// Unique identifier for the prover
    pub unique_id: u64,
    /// Prover's public key
    pub prover_pubkey: Pubkey,
    /// Hash of prover's public key
    pub prover_pubkey_hash: [u8; 32],
    /// Total number of provers after registration
    pub total_provers: u32,
    /// Timestamp when registered
    pub timestamp: i64,
}

//! Event emitted when a prover is deactivated
//!
//! This event is emitted after successfully deactivating a prover in the prover registry.

use anchor_lang::prelude::*;

/// Event emitted when a prover is deactivated
#[event]
pub struct ProverDeactivated {
    /// Admin who deactivated the prover
    pub admin: Pubkey,
    /// Prover's public key that was deactivated
    pub prover_pubkey: Pubkey,
    /// Hash of prover's public key
    pub prover_pubkey_hash: [u8; 32],
    /// Timestamp when deactivated
    pub timestamp: i64,
}

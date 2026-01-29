//! Event emitted when an attestation is submitted
//!
//! This event is emitted after successfully submitting an attestation for a UTXO.

use anchor_lang::prelude::*;

/// Event emitted when an attestation is submitted
#[event]
pub struct AttestationSubmitted {
    /// The UTXO being voted on
    pub utxo: Pubkey,
    /// UTXO hash
    pub utxo_hash: [u8; 32],
    /// Old prover's public key (before rotation)
    pub prover_old: Pubkey,
    /// Old prover's hash
    pub prover_old_hash: [u8; 32],
    /// New prover's public key (after rotation)
    pub prover_new: Pubkey,
    /// Prover's unique ID
    pub prover_unique_id: u64,
    /// The vote (true=valid, false=invalid)
    pub vote: bool,
    /// Hash of prover's next public key (for next rotation)
    pub next_key_hash: [u8; 32],
    /// Lamports transferred
    pub lamports_transferred: u64,
    /// Current count of valid votes
    pub valid_votes: u16,
    /// Current count of invalid votes
    pub invalid_votes: u16,
    /// Total votes received
    pub total_votes: u16,
    /// Whether threshold was met
    pub threshold_met: bool,
    /// New ledger tip hash (if threshold met)
    pub new_ledger_tip: Option<[u8; 32]>,
    /// New ledger count (if threshold met)
    pub new_ledger_count: Option<u64>,
    /// Timestamp when submitted
    pub timestamp: i64,
}

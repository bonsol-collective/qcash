//! Event emitted when the program is initialized
//!
//! This event is emitted after successfully initializing the program configuration and prover registry.

use anchor_lang::prelude::*;

/// Event emitted when the program is initialized
#[event]
pub struct ProgramInitialized {
    /// Admin authority who initialized the program
    pub admin: Pubkey,
    /// Minimum attestations required for UTXO validity
    pub min_attestations: u16,
    /// Program config PDA bump
    pub config_bump: u8,
    /// Prover registry PDA bump
    pub registry_bump: u8,
    /// Timestamp when initialized
    pub timestamp: i64,
}

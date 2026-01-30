//! Events structures and definitions
//!
//! This module defines the various events emitted by the qcash program during its operations.

pub mod program_initialized;
pub mod prover_registered;
pub mod prover_deactivated;
pub mod ledger_initialized;
pub mod vault_initialized;
pub mod vault_completed;
pub mod loader_initialized;
pub mod loader_chunk_written;
pub mod zk_proof_initialized;
pub mod zk_proof_chunk_written;
pub mod utxo_created;
pub mod attestation_submitted;
pub mod airdrop_completed;

pub use program_initialized::*;
pub use prover_registered::*;
pub use prover_deactivated::*;
pub use ledger_initialized::*;
pub use vault_initialized::*;
pub use vault_completed::*;
pub use loader_initialized::*;
pub use loader_chunk_written::*;
pub use zk_proof_initialized::*;
pub use zk_proof_chunk_written::*;
pub use utxo_created::*;
pub use attestation_submitted::*;
pub use airdrop_completed::*;

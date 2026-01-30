//! Events structures and definitions
//!
//! This module defines the various events emitted by the qcash program during its operations.

<<<<<<< HEAD
pub mod airdrop_completed;
=======
use anchor_lang::{AnchorDeserialize, Discriminator, Result};

>>>>>>> 89cf238 (feat: add event parsing functionality to QcashEvent enum)
pub mod attestation_submitted;
pub mod ledger_initialized;
pub mod loader_chunk_written;
pub mod loader_initialized;
pub mod program_initialized;
pub mod prover_deactivated;
pub mod prover_registered;
pub mod utxo_created;
pub mod vault_completed;
pub mod vault_initialized;
pub mod zk_proof_chunk_written;
pub mod zk_proof_initialized;

pub use airdrop_completed::*;
pub use attestation_submitted::*;
pub use attestation_submitted::*;
pub use ledger_initialized::*;
pub use loader_chunk_written::*;
pub use loader_initialized::*;
pub use program_initialized::*;
pub use prover_deactivated::*;
pub use prover_registered::*;
pub use utxo_created::*;
pub use vault_completed::*;
pub use vault_initialized::*;
pub use zk_proof_chunk_written::*;
pub use zk_proof_initialized::*;

pub enum QcashEvent {
    AttestationSubmitted(AttestationSubmitted),
    LedgerInitialized(LedgerInitialized),
    LoaderChunkWritten(LoaderChunkWritten),
    LoaderInitialized(LoaderInitialized),
    ProgramInitialized(ProgramInitialized),
    ProverDeactivated(ProverDeactivated),
    ProverRegistered(ProverRegistered),
    UtxoCreated(UtxoCreated),
    VaultCompleted(VaultCompleted),
    VaultInitialized(VaultInitialized),
    ZkProofChunkWritten(ZkProofChunkWritten),
    ZkProofInitialized(ZkProofInitialized),
}

impl QcashEvent {
    /// Parse raw event data into a QssnEvent enum
    pub fn parse(data: &[u8]) -> Result<Self> {
        // Extract discriminator (first 8 bytes)
        let discriminator = &data[..8];

        // Parse based on discriminator using match
        match discriminator {
            AttestationSubmitted::DISCRIMINATOR => {
                let event = AttestationSubmitted::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::AttestationSubmitted(event))
            }
            LedgerInitialized::DISCRIMINATOR => {
                let event = LedgerInitialized::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::LedgerInitialized(event))
            }
            LoaderChunkWritten::DISCRIMINATOR => {
                let event = LoaderChunkWritten::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::LoaderChunkWritten(event))
            }
            LoaderInitialized::DISCRIMINATOR => {
                let event = LoaderInitialized::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::LoaderInitialized(event))
            }
            ProgramInitialized::DISCRIMINATOR => {
                let event = ProgramInitialized::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::ProgramInitialized(event))
            }
            ProverDeactivated::DISCRIMINATOR => {
                let event = ProverDeactivated::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::ProverDeactivated(event))
            }
            ProverRegistered::DISCRIMINATOR => {
                let event = ProverRegistered::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::ProverRegistered(event))
            }
            UtxoCreated::DISCRIMINATOR => {
                let event = UtxoCreated::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::UtxoCreated(event))
            }
            VaultCompleted::DISCRIMINATOR => {
                let event = VaultCompleted::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::VaultCompleted(event))
            }
            VaultInitialized::DISCRIMINATOR => {
                let event = VaultInitialized::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::VaultInitialized(event))
            }
            ZkProofChunkWritten::DISCRIMINATOR => {
                let event = ZkProofChunkWritten::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::ZkProofChunkWritten(event))
            }
            ZkProofInitialized::DISCRIMINATOR => {
                let event = ZkProofInitialized::deserialize(&mut &data[8..])?;
                Ok(QcashEvent::ZkProofInitialized(event))
            }
            _ => {
                // Return an error for unknown discriminators
                Err(anchor_lang::error::Error::from(
                    anchor_lang::error::ErrorCode::EventDiscriminatorNotFound
                ))
            }
        }
    }
}

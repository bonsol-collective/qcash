// Business Source License 1.1 (BSL 1.1)
// Licensor: Bonsol Labs
// Licensed Work: QCash
// Change Date: 2030-12-31
// Change License: Apache License 2.0
// Use of this software is governed by the LICENSE file.

use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Kyber Public key must be exactly 1184 bytes long")]
    InvalidKeyLength,
    
    #[msg("Chunk size exceeds maximum allowed length of 800 bytes")]
    ChunkSizeExceeded,
    
    #[msg("Hash Mismatch: Provided key does not match the expected hash")]
    HashMismatch,
    
    #[msg("Invalid previous UTXO hash provided")]
    InvalidPreviousUtxoHash,
    
    #[msg("Payload too large")]
    PayloadTooLarge,
    
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    
    #[msg("Invalid offset: must match current bytes_written")]
    InvalidOffset,

    #[msg("Program config already initialized")]
    ProgramConfigAlreadyInitialized,

    #[msg("Admin authority not set")]
    AdminAuthorityNotSet,

    #[msg("Unauthorized: Only admin can perform this action")]
    UnauthorizedAdmin,

    #[msg("Prover already registered")]
    ProverAlreadyRegistered,

    #[msg("Prover not registered")]
    ProverNotRegistered,

    #[msg("Prover not active")]
    ProverNotActive,

    #[msg("Prover already voted on this UTXO")]
    ProverAlreadyVoted,

    #[msg("Maximum provers reached")]
    MaxProversReached,

    #[msg("Maximum votes reached for this UTXO")]
    MaxVotesReached,

    #[msg("Invalid stake amount")]
    InvalidStakeAmount,

    #[msg("Prover unique ID already used")]
    ProverUniqueIdAlreadyUsed,

    #[msg("Invalid prover unique ID. Cannot be zero.")]
    InvalidProverUniqueId,

    #[msg("ZK Proof account not provided")]
    ZkProofAccountNotProvided,

    #[msg("UTXO hash mismatch with ledger")]
    UtxoHashMismatch,

    #[msg("Min attestations not met")]
    MinAttestationsNotMet,
}

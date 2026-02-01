// Business Source License 1.1 (BSL 1.1)
// Licensor: Bonsol Labs
// Licensed Work: QCash
// Change Date: 2030-12-31
// Change License: Apache License 2.0
// Use of this software is governed by the LICENSE file.

use anchor_lang::prelude::*;

#[constant]
pub const SEED: &str = "anchor";

/// Maximum number of provers in registry
pub const MAX_PROVERS: usize = 100;

/// Minimum attestations required for UTXO to be valid
pub const MIN_ATTESTATIONS_REQUIRED: u16 = 1;

/// Maximum votes allowed per UTXO (same as MAX_PROVERS for simplicity)
pub const MAX_VOTES_ALLOWED: usize = 10;

/// Kyber ciphertext size
pub const KYBER_CIPHERTEXT_SIZE: usize = 1088;

/// Maximum payload size for encrypted data
pub const MAX_PAYLOAD_SIZE: usize = 2048;

/// ChaCha20 nonce size
pub const NONCE_SIZE: usize = 12;

/// Seed for program config PDA
pub const PROGRAM_CONFIG_SEED: &[u8] = b"program_config";

/// Seed for prover registry PDA
pub const PROVER_REGISTRY_SEED: &[u8] = b"prover_registry";

/// Seed for ledger PDA
pub const LEDGER_SEED: &[u8] = b"ledger";

/// Seed for UTXO PDA
pub const UTXO_SEED: &[u8] = b"utxo";

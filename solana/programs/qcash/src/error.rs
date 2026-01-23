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
    InvalidHashMismatch,
}

use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Kyber Public key must be exactly 1184 bytes long")]
    InvalidKeyLength,
}

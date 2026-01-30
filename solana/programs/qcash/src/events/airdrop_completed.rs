use anchor_lang::prelude::*;

/// Event emitted when an airdrop is completed
#[event]
pub struct AirdropCompleted {
    /// UTXO account PDA
    pub utxo: Pubkey,
    /// UTXO hash
    pub utxo_hash: [u8; 32],
    /// Previous UTXO hash
    pub prev_utxo_hash: [u8; 32],
    /// Epoch number
    pub epoch: u32,
    /// Encrypted payload size
    pub payload_size: u32,
    /// Ciphertext commitment
    pub ciphertext_commitment: [u8; 32],
    /// UTXO PDA bump
    pub bump: u8,
    /// New ledger count after airdrop
    pub new_ledger_count: u64,
    /// Timestamp when created
    pub timestamp: i64,
}

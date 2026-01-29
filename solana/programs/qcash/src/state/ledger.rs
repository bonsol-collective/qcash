use anchor_lang::prelude::*;

/// Ledger account that tracks the last valid UTXO hash
#[account]
#[derive(Default)]
pub struct Ledger {
    /// Total number of valid UTXOs
    pub count: u64,
    
    /// Hash of the last valid UTXO (genesis is all zeros)
    pub last_valid_utxo_hash: [u8; 32],
    
    /// Bump seed for PDA
    pub bump: u8,
}

impl Ledger {
    /// Size of the Ledger account in bytes
    pub const SIZE: usize = 8 + // discriminator
        8 + // count
        32 + // last_valid_utxo_hash
        1 + // bump
        64; // padding for future fields

    /// Initialize the ledger with genesis state
    pub fn initialize(&mut self, bump: u8) {
        self.count = 0;
        self.last_valid_utxo_hash = [0u8; 32]; // genesis hash
        self.bump = bump;
    }

    /// Get the tip hash for chain validation
    pub fn get_tip_hash(&self) -> [u8; 32] {
        self.last_valid_utxo_hash
    }

    /// Update the last valid UTXO hash and increment count
    pub fn update_tip(&mut self, new_utxo_hash: [u8; 32]) {
        self.last_valid_utxo_hash = new_utxo_hash;
        self.count += 1;
    }
}

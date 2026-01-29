use anchor_lang::prelude::*;

/// Program configuration account
#[account]
#[derive(Default)]
pub struct ProgramConfig {
    /// Admin authority who can manage provers
    pub admin_authority: Pubkey,
    
    /// Minimum attestations required for UTXO validity
    pub min_attestations: u16,
    
    /// Bump seed for PDA
    pub bump: u8,
}

impl ProgramConfig {
    /// Size of the ProgramConfig account in bytes
    pub const SIZE: usize = 8 + // discriminator
        32 + // admin_authority
        2 + // min_attestations
        1 + // bump
        128; // padding for future fields

    /// Initialize the program config
    pub fn initialize(&mut self, admin_authority: Pubkey, min_attestations: u16, bump: u8) {
        self.admin_authority = admin_authority;
        self.min_attestations = min_attestations;
        self.bump = bump;
    }

    /// Check if admin authority is set
    pub fn is_admin_set(&self) -> bool {
        self.admin_authority != Pubkey::default()
    }

    /// Check if given pubkey is the admin
    pub fn is_admin(&self, pubkey: &Pubkey) -> bool {
        self.admin_authority == *pubkey
    }
}

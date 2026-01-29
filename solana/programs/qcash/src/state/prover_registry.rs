use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ErrorCode;

/// Information about a single prover
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct ProverInfo {
    /// Unique identifier for the prover
    pub unique_id: u64,

    /// Hash of prover's current public key
    pub pubkey_hash: [u8; 32],

    /// Whether the prover is currently active
    pub is_active: bool,
}

impl ProverInfo {
    /// Size in bytes
    pub const SIZE: usize = 8 + // unique_id
        32 + // pubkey_hash
        1; // is_active

    /// Creates a new ProverInfo
    pub fn new(unique_id: u64, pubkey_hash: [u8; 32]) -> Self {
        Self {
            unique_id,
            pubkey_hash,
            is_active: true,
        }
    }

    /// Checks if the prover is active
    pub fn is_active(&self) -> bool {
        self.is_active
    }

    /// Activates the prover
    pub fn activate(&mut self) {
        self.is_active = true;
    }

    /// Deactivates the prover
    pub fn deactivate(&mut self) {
        self.is_active = false;
    }

    /// Updates the public key hash (for key rotation)
    pub fn update_pubkey_hash(&mut self, new_pubkey_hash: [u8; 32]) {
        self.pubkey_hash = new_pubkey_hash;
    }
}

/// Prover registry account
#[account]
#[derive(Default)]
pub struct ProverRegistry {
    /// Number of registered provers
    pub prover_count: u32,

    /// Bump seed for PDA derivation
    pub bump: u8,

    /// Array of prover information
    pub provers: Vec<ProverInfo>,
}

impl ProverRegistry {
    /// Maximum size of the prover registry account
    pub const MAX_SIZE: usize = 8 + // discriminator
        4 + // prover_count
        1 + // bump
        4 + // Vec length prefix
        (ProverInfo::SIZE * MAX_PROVERS); // provers (max 100 provers)

    /// Initialize a new ProverRegistry
    pub fn initialize(&mut self, bump: u8) {
        self.prover_count = 0;
        self.bump = bump;
        self.provers = Vec::with_capacity(MAX_PROVERS);
    }

    /// Registers a new prover
    pub fn register_prover(&mut self, unique_id: u64, pubkey_hash: [u8; 32]) -> Result<()> {
        // Validate unique ID is not zero
        require!(unique_id != 0, ErrorCode::InvalidProverUniqueId);

        // Check if prover is already registered
        require!(
            self.find_prover(&pubkey_hash).is_none(),
            ErrorCode::ProverAlreadyRegistered
        );

        // Check if maximum provers reached
        require!(
            (self.prover_count as usize) < MAX_PROVERS,
            ErrorCode::MaxProversReached
        );

        // Check unique ID not already used
        let ids_used: Vec<u64> = self.provers.iter().map(|p| p.unique_id).collect();
        for &used_id in &ids_used {
            require!(
                used_id != unique_id,
                ErrorCode::ProverUniqueIdAlreadyUsed
            );
        }

        // Add new prover
        let prover = ProverInfo::new(unique_id, pubkey_hash);
        self.provers.push(prover);
        self.prover_count += 1;

        Ok(())
    }

    /// Finds a prover by public key hash
    pub fn find_prover(&self, pubkey_hash: &[u8; 32]) -> Option<usize> {
        self.provers
            .iter()
            .position(|p| &p.pubkey_hash == pubkey_hash)
    }

    /// Gets a mutable reference to a prover by public key hash
    pub fn get_prover_mut(&mut self, pubkey_hash: &[u8; 32]) -> Result<&mut ProverInfo> {
        let index = self
            .find_prover(pubkey_hash)
            .ok_or(ErrorCode::ProverNotRegistered)?;
        Ok(&mut self.provers[index])
    }

    /// Deactivates a prover
    pub fn deactivate_prover(&mut self, pubkey_hash: &[u8; 32]) -> Result<()> {
        let prover = self.get_prover_mut(pubkey_hash)?;
        prover.deactivate();
        Ok(())
    }
}

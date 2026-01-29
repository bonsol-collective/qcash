use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::ErrorCode;

/// Vote record for a prover on a UTXO
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, PartialEq, Eq)]
pub struct ProverVote {
    /// Unique ID of the prover
    pub prover_id: u64,
    /// Vote value: true = valid, false = invalid
    pub is_valid: bool,
}

impl ProverVote {
    pub const SIZE: usize = 8 + 1; // prover_id + is_valid

    /// Checks if this vote entry is used
    pub fn is_used(&self) -> bool {
        self.prover_id != 0
    }

    /// Creates a new vote entry
    pub fn new(prover_id: u64, is_valid: bool) -> Self {
        Self { prover_id, is_valid }
    }
}

/// UTXO account structure
#[account]
pub struct Utxo {
    /// Epoch number
    pub epoch: u32,
    
    /// Hash of this UTXO
    pub utxo_hash: [u8; 32],
    
    /// Hash of previous UTXO
    pub prev_utxo_hash: [u8; 32],
    
    /// SHA256 commitment of ciphertext+payload+nonce
    pub ciphertext_commitment: [u8; 32],
    
    /// ChaCha20 nonce for decryption
    pub nonce: [u8; NONCE_SIZE],
    
    /// Encrypted payload data
    pub encrypted_payload: Vec<u8>,
    
    /// Kyber ciphertext for shared secret
    pub kyber_ciphertext: [u8; KYBER_CIPHERTEXT_SIZE],
    
    /// Reference to ZK proof account
    pub zk_proof_pubkey: Pubkey,
    
    /// Map of prover votes (prover_id -> vote)
    pub votes: [ProverVote; MAX_VOTES_ALLOWED],
    
    /// Bump seed for PDA
    pub bump: u8,
}

impl Utxo {
    /// Calculate size based on payload length
    pub fn size(payload_len: usize) -> usize {
        8 + // discriminator
        4 + // epoch
        32 + // utxo_hash
        32 + // prev_utxo_hash
        32 + // ciphertext_commitment
        NONCE_SIZE + // nonce
        4 + payload_len + // encrypted_payload (Vec prefix + data)
        KYBER_CIPHERTEXT_SIZE + // kyber_ciphertext
        32 + // zk_proof_pubkey
        (ProverVote::SIZE * MAX_VOTES_ALLOWED) + // votes array
        1 + // bump
        128 // padding
    }

    /// Initialize a new UTXO
    pub fn initialize(
        &mut self,
        epoch: u32,
        utxo_hash: [u8; 32],
        prev_utxo_hash: [u8; 32],
        ciphertext_commitment: [u8; 32],
        nonce: [u8; NONCE_SIZE],
        encrypted_payload: Vec<u8>,
        kyber_ciphertext: [u8; KYBER_CIPHERTEXT_SIZE],
        zk_proof_pubkey: Pubkey,
        bump: u8,
    ) {
        self.epoch = epoch;
        self.utxo_hash = utxo_hash;
        self.prev_utxo_hash = prev_utxo_hash;
        self.ciphertext_commitment = ciphertext_commitment;
        self.nonce = nonce;
        self.encrypted_payload = encrypted_payload;
        self.kyber_ciphertext = kyber_ciphertext;
        self.zk_proof_pubkey = zk_proof_pubkey;
        self.votes = [ProverVote::default(); MAX_VOTES_ALLOWED];
        self.bump = bump;
    }

    /// Record a vote from a prover
    pub fn record_vote(&mut self, prover_unique_id: u64, is_valid: bool) -> Result<()> {
        // Check if prover has already voted
        require!(
            !self.has_prover_voted(prover_unique_id),
            ErrorCode::ProverAlreadyVoted
        );

        // Find first empty slot
        let empty_slot = self
            .votes
            .iter()
            .position(|vote| !vote.is_used())
            .ok_or(ErrorCode::MaxVotesReached)?;

        // Record the vote
        self.votes[empty_slot] = ProverVote::new(prover_unique_id, is_valid);

        Ok(())
    }

    /// Checks if a prover has already voted
    pub fn has_prover_voted(&self, prover_unique_id: u64) -> bool {
        self.votes
            .iter()
            .any(|vote| vote.is_used() && vote.prover_id == prover_unique_id)
    }

    /// Gets the number of valid votes
    pub fn get_valid_votes(&self) -> u16 {
        self.votes
            .iter()
            .filter(|vote| vote.is_used() && vote.is_valid)
            .count() as u16
    }

    /// Gets the number of invalid votes
    pub fn get_invalid_votes(&self) -> u16 {
        self.votes
            .iter()
            .filter(|vote| vote.is_used() && !vote.is_valid)
            .count() as u16
    }

    /// Gets the total number of votes
    pub fn get_total_votes(&self) -> u16 {
        self.votes.iter().filter(|vote| vote.is_used()).count() as u16
    }

    /// Checks if minimum attestations threshold is met
    pub fn threshold_met(&self, min_attestations: u16) -> bool {
        self.get_valid_votes() >= min_attestations
    }
}

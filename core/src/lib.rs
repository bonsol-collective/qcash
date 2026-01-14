use serde::{Deserialize, Serialize};

pub const KYBER_PUBKEY_SIZE:usize = 1184; // kyber-768
pub const KYBER_CIPHERTEXT_SIZE:usize = 1088;
pub const HASH_SIZE:usize = 32;

pub type HASH = [u8;HASH_SIZE];
pub type KyberPubKey = [u8;KYBER_PUBKEY_SIZE];

#[derive(Clone,Debug,Serialize,Deserialize,PartialEq)]
pub struct UTXOCommitmentHeader{
    pub utxo_hash:HASH,
    pub prev_utxo_hash: HASH,
    pub ciphertext_commitment: HASH,
    pub epoch: u32,
}

 #[derive(Clone,Debug,Serialize,Deserialize,PartialEq)]
pub struct UTXOEncryptedPayload{
    pub amount:u64,
    pub is_return:bool,
    #[serde(with = "serde_arrays")]
    pub receiver_vault: KyberPubKey,
    pub randomness:[u8;32],
    pub utxo_spent_list:Vec<HASH>,
    pub version:u8,
}

#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct QSPVGuestInput{
    pub sender_private_key_fragment:[u8;32],
    pub input_utxos:Vec<DecryptedInput>,
    #[serde(with = "serde_arrays")]
    pub receiver_pubkey:KyberPubKey,
    pub amount_to_send:u64,
    pub receiver_randomness:[u8;32],
    pub return_randomness:[u8;32],
    pub current_ledger_tip:HASH,
}

#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct DecryptedInput{
    pub header:UTXOCommitmentHeader,
    pub payload:UTXOEncryptedPayload,
}

// Prover Output
#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct QspvGuestOutput{
    pub receiver_commitment: UTXOCommitmentHeader,
    pub return_commitment: UTXOCommitmentHeader,
    // Todo: Also output the encrypted payload also
}


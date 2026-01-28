use bip39::rand;
use hmac::{Hmac, Mac};
use pqc_kyber::{CryptoRng, Keypair, RngCore, keypair};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

pub const KYBER_PUBKEY_SIZE:usize = 1184; // kyber-768
pub const KYBER_CIPHERTEXT_SIZE:usize = 1088;
pub const HASH_SIZE:usize = 32;

pub type HASH = [u8;HASH_SIZE];
pub type KyberPubKey = [u8;KYBER_PUBKEY_SIZE];

#[cfg(feature = "wallet")]
pub mod wallet;

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
    pub receiver_vault: [u8;32],
    pub randomness:[u8;32],
    pub utxo_spent_list:Vec<HASH>,
    pub version:u8,
}

#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct QSPVGuestInput{
    // This is 32-byte seed, not the full secret key blob
    pub sender_private_key_fragment:[u8;32],
    pub input_utxos:Vec<DecryptedInput>,
    // We use serde_arrays because default serde struggles with array > 32 bytes
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
    pub amount:u64,
    pub randomness:[u8;32],
}

// Prover Output
#[derive(Clone,Debug,Serialize,Deserialize)]
pub struct QspvGuestOutput{
    pub receiver_commitment: UTXOCommitmentHeader,
    pub return_commitment: UTXOCommitmentHeader,
    // output the encrypted payload also
}

// This will store a derived secret as the randomness for kyber
pub struct DeterministicRng{
    seed_bytes:Vec<u8>,
    cursor:usize,
}

impl DeterministicRng{
    pub fn new(seed:&[u8])->Self{
        // Takes the input seed (32 bytes), expand it using HMAC-SHA256
        // to create a long stream of bytes (256 bytes) and store it in the seed_bytes
        let mut seed_bytes = Vec::new();

        // kyber needs ~64 bytes.We generate 256 bytes(8 Block * 32 bytes) to be absolutely future proof

        for i in 0..8{

            // reinitialize the HMAC
            let mut mac  = Hmac::<Sha256>::new_from_slice(&seed).expect("HMAC should accept any key length");

            mac.update(&[i as u8]);

            // Finalize produces the hash and RESET the mac to the initial state(key loaded)
            let result = mac.finalize().into_bytes();

           seed_bytes.extend_from_slice(&result);
        }
        Self { seed_bytes, cursor: 0 }
    }
}

impl CryptoRng for DeterministicRng{}

impl RngCore for DeterministicRng{
    fn next_u32(&mut self) -> u32 {
        self.next_u64() as u32
    }

    fn next_u64(&mut self) -> u64 {
        let mut buf = [0u8;8];

        self.fill_bytes(&mut buf);

        u64::from_le_bytes(buf)
    }

    // copy bytes form from self.seed_bytes to dst
    // we uses a ring buffer
    fn fill_bytes(&mut self, dst: &mut [u8]) {
       if self.seed_bytes.is_empty() {
            panic!("DeterministicRng not initialized with seed bytes");
       }

       for i in 0..dst.len(){
            let idx = (self.cursor) % self.seed_bytes.len();
            dst[i] = self.seed_bytes[idx];

            self.cursor +=1;

       }
    }

    fn try_fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), rand::Error> {
        self.fill_bytes(dest);
        Ok(())
    }
}

pub fn derive_kyber_key(fragment: &[u8; 32]) -> Keypair {
    let mut rng = DeterministicRng::new(fragment);
    keypair(&mut rng).expect("Kyber Keygen Failed")
}

use bip39::{Mnemonic};
use ed25519_dalek::SigningKey;
use ed25519_dalek_bip32::{ChildIndex, ExtendedSigningKey};
use hmac::{Hmac, Mac};
use pqc_kyber::{CryptoRng, Keypair, RngCore};
use sha2::{Sha256};
use crate::DeterministicRng;

pub struct WalletKeys{
    pub solana_key:SigningKey,
    pub kyber_key:Keypair,
    pub secret_entropy:[u8;32],
    pub mnemonic:String,
}

impl WalletKeys{
    pub fn new()->Self{
        let mnemonic = Mnemonic::generate_in(bip39::Language::English, 12).unwrap();

        Self::from_mnemonic(mnemonic.to_string().as_str())
    }

    pub fn from_mnemonic(phrase:&str)->Self{
        // Step A): Get Seed from Mnemonic
        let mnemonic = Mnemonic::parse(phrase).expect("Invalid Mnemonic");
        // Giving empty passphrase for now
        let seed = mnemonic.to_seed("");

        // root key
        let root = ExtendedSigningKey::from_seed(&seed).expect("Root key generation failed");

        // Step B) Derive Solana key (SLIP-0010)
        let solana_path = [
            ChildIndex::hardened(44).unwrap(),
            ChildIndex::hardened(501).unwrap(),
            ChildIndex::hardened(0).unwrap(),
            ChildIndex::hardened(0).unwrap(),
        ];

        let sol_extended = root.derive(&solana_path).expect("Solana derivation failed");
        let solana_key = sol_extended.signing_key;

        // Step C) Derive Kyber Keypair
        let vault_path = [
            ChildIndex::hardened(44).unwrap(),
            ChildIndex::hardened(1024).unwrap(),
            ChildIndex::hardened(0).unwrap(),
        ];

        let vault_extended = root.derive(&vault_path).expect("Vault Derivation failed");

        let kyber_entropy = vault_extended.signing_key.to_bytes();
        let mut drng = DeterministicRng::new(&kyber_entropy);

        let kyber_key = Keypair::generate(&mut drng).expect("kyber keygen failed");

        Self {
            solana_key,
            kyber_key,
            secret_entropy: kyber_entropy,
            mnemonic: phrase.to_string()
        }
    }

    pub fn get_solana_address(&self)->String{
        bs58::encode(self.solana_key.verifying_key()).into_string()
    }
}

use std::{path::Path, time::Duration};

use anchor_lang::prelude::*;
use anyhow::{Error, Result, anyhow};
use base64::{Engine, prelude::BASE64_STANDARD};
use futures::{StreamExt, stream};
use interface::{PROGRAM_ID, accounts, instructions, submit_attestation};
use qcash::QcashEvent;
use risc0_zkvm::Receipt;
use sha2::{Digest, Sha256};
use solana_client::{
    nonblocking::rpc_client::RpcClient,
    rpc_config::{RpcTransactionLogsConfig, RpcTransactionLogsFilter},
};
use solana_pubsub_client::nonblocking::pubsub_client::PubsubClient;
use solana_sdk::{
    commitment_config::CommitmentConfig, message::Message, signature::Keypair, signer::Signer,
    transaction::Transaction,
};
use tokio::sync::{Mutex, mpsc};
use tracing::{debug, error, info, warn};

// Guest ID: [3123149550, 2958403742, 1163198136, 2906478055, 1985551465, 1662932468, 127326852, 1286749865]
// Converted to [u8; 32] using little-endian byte order
pub const IMAGE_ID: [u8; 32] = [
    127, 44, 174, 85, 213, 14, 167, 223, 46, 79, 95, 39, 209, 68, 82, 95, 37, 120, 61, 89, 212, 94,
    103, 53, 174, 150, 40, 72, 59, 19, 163, 255,
];

/// Solana Key Manager for handling key rotation and management
pub struct SolanaKeyManager {
    current_key_file: String,
    next_key_file: String,
    previous_key_file: String,
    current_key: Keypair,
    next_key: Keypair,
    previous_key: Keypair,
}

impl SolanaKeyManager {
    /// Create a new SolanaKeyManager with the given key files
    pub fn new(
        current_key_file: String,
        next_key_file: String,
        previous_key_file: String,
    ) -> Result<Self> {
        // Load or create previous key
        if !Path::new(&previous_key_file).exists() {
            info!("No previous key found, rotating keys...");
            // If no previous key exists, copy current key to previous and rotate keys
            std::fs::copy(&current_key_file, &previous_key_file)?;

            // Move next key to current
            std::fs::copy(&next_key_file, &current_key_file)?;

            // Generate new next key
            Self::generate_solana_key(&next_key_file)?;
        }

        // Load the final keys
        let previous_key = Self::load_solana_key(&previous_key_file)?;
        let current_key = Self::load_solana_key(&current_key_file)?;
        let next_key = Self::load_solana_key(&next_key_file)?;

        Ok(Self {
            current_key_file,
            next_key_file,
            previous_key_file,
            current_key,
            next_key,
            previous_key,
        })
    }

    /// Create a new SolanaKeyManager by generating all new keys
    pub fn new_with_new_keys(
        current_key_file: String,
        next_key_file: String,
        previous_key_file: String,
    ) -> Result<Self> {
        info!("Generating all new Solana keys");

        // Generate all three keys
        Self::generate_solana_key(&current_key_file)?;
        Self::generate_solana_key(&next_key_file)?;
        Self::generate_solana_key(&previous_key_file)?;

        // Load the generated keys
        let previous_key = Self::load_solana_key(&previous_key_file)?;
        let current_key = Self::load_solana_key(&current_key_file)?;
        let next_key = Self::load_solana_key(&next_key_file)?;

        Ok(Self {
            current_key_file,
            next_key_file,
            previous_key_file,
            current_key,
            next_key,
            previous_key,
        })
    }

    /// Load Solana keypair from file
    fn load_solana_key(key_file: impl AsRef<Path>) -> Result<Keypair> {
        debug!("Loading Solana key from {:?}", key_file.as_ref());

        if !key_file.as_ref().exists() {
            return Err(anyhow!(
                "Solana key file not found at {:?}. Generate a key first.",
                key_file.as_ref()
            ));
        }

        let key_data = std::fs::read(key_file)?;
        let keypair = Keypair::try_from(&key_data[..])
            .map_err(|e| anyhow!("Failed to parse Solana keypair: {}", e))?;

        debug!("Loaded Solana key with public key: {}", keypair.pubkey());

        Ok(keypair)
    }

    /// Generate a new Solana keypair and save to file
    fn generate_solana_key(output: impl AsRef<Path>) -> Result<()> {
        info!("Generating new Solana key pair");

        let keypair = Keypair::new();
        let key_bytes = keypair.to_bytes();

        std::fs::write(&output, &key_bytes)?;

        info!("Generated Solana key pair saved to {:?}", output.as_ref());

        Ok(())
    }

    /// Rotate Solana keys: current becomes previous, next becomes current, generate new next
    pub fn rotate_keys(&mut self) -> Result<()> {
        info!("Rotating Solana keys");

        // Move current key to previous (backup)
        std::fs::copy(&self.current_key_file, &self.previous_key_file)?;

        // Move next key to current
        std::fs::copy(&self.next_key_file, &self.current_key_file)?;

        // Generate new next key
        Self::generate_solana_key(&self.next_key_file)?;

        // Reload keys
        self.previous_key = Self::load_solana_key(&self.previous_key_file)?;
        self.current_key = Self::load_solana_key(&self.current_key_file)?;
        self.next_key = Self::load_solana_key(&self.next_key_file)?;

        info!("Solana key rotation completed");

        Ok(())
    }

    /// Get the current Solana key
    pub fn current_key(&self) -> &Keypair {
        &self.current_key
    }

    /// Get SHA256 hash of the next key
    pub fn next_key_hash(&self) -> Vec<u8> {
        let mut hasher = Sha256::new();
        hasher.update(self.next_key.pubkey().as_ref());
        hasher.finalize().to_vec()
    }

    /// Get the previous Solana key
    pub fn previous_key(&self) -> &Keypair {
        &self.previous_key
    }
}

pub struct QcashNodeConfig {
    pub previous_key_file: Option<String>, //Default current-key + .previous
    pub current_key_file: String,
    pub next_key_file: Option<String>, //Default current-key + .next
    pub websocket_url: String,
    pub rpc_url: String,
    pub generate_keys: bool,
}

impl QcashNodeConfig {
    pub fn new_from_env() -> Result<Self> {
        let current_key_file = std::env::var("SOLANA_CURRENT_KEY_FILE")
            .map_err(|_| anyhow!("SOLANA_CURRENT_KEY_FILE environment variable not set"))?;
        let previous_key_file = std::env::var("SOLANA_PREVIOUS_KEY_FILE").ok();
        let next_key_file = std::env::var("SOLANA_NEXT_KEY_FILE").ok();
        let websocket_url = std::env::var("SOLANA_WEBSOCKET_URL")
            .unwrap_or_else(|_| "ws://localhost:8900".to_string());
        let rpc_url =
            std::env::var("SOLANA_RPC_URL").unwrap_or_else(|_| "http://localhost:8899".to_string());
        let generate_keys = std::env::var("GENERATE_KEYS")
            .map(|v| v.to_lowercase() == "true" || v == "1")
            .unwrap_or(false);

        Ok(Self {
            previous_key_file,
            current_key_file,
            next_key_file,
            websocket_url,
            rpc_url,
            generate_keys,
        })
    }
}

pub struct QcashNode {
    key_manager: Mutex<SolanaKeyManager>,
    websocket_url: String,
    rpc_client: RpcClient,
}

impl QcashNode {
    pub fn new_from_config(config: QcashNodeConfig) -> Result<Self> {
        let current_key_file = config.current_key_file;
        let next_key_file = match config.next_key_file {
            Some(file) => file,
            None => format!("{}.next", current_key_file),
        };
        let previous_key_file = match config.previous_key_file {
            Some(file) => file,
            None => format!("{}.previous", current_key_file),
        };

        // Check if keys exist before generating new ones
        let keys_exist = Path::new(&current_key_file).exists()
            && Path::new(&next_key_file).exists()
            && Path::new(&previous_key_file).exists();

        let key_manager = if config.generate_keys {
            if keys_exist {
                warn!(
                    "GENERATE_KEYS is set to true, but keys already exist. Loading existing keys instead of generating new ones."
                );
                SolanaKeyManager::new(current_key_file, next_key_file, previous_key_file)?
            } else {
                SolanaKeyManager::new_with_new_keys(
                    current_key_file,
                    next_key_file,
                    previous_key_file,
                )?
            }
        } else {
            SolanaKeyManager::new(current_key_file, next_key_file, previous_key_file)?
        };

        // print the previous key (call it current key) and the current key (call it next key)
        info!("Node key: {}", key_manager.previous_key().pubkey());
        info!(
            "Next key hash: {}",
            hex::encode(key_manager.next_key_hash())
        );

        Ok(QcashNode {
            key_manager: Mutex::new(key_manager),
            websocket_url: config.websocket_url,
            rpc_client: RpcClient::new(config.rpc_url),
        })
    }

    pub async fn run(&self) {
        let websocket_url = self.websocket_url.clone();
        let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();

        // Spawn the events subscription thread
        tokio::spawn(async move {
            if let Err(e) = events_subscription(websocket_url, tx).await {
                error!("Events subscription failed: {}", e);
            }
        });

        // Start event processing thread
        while let Some(event) = rx.recv().await {
            self.process_event(event).await;
        }
    }

    async fn process_event(&self, event: Vec<u8>) {
        // Parse the event object and process ZkProofChunkWritten messages
        match QcashEvent::parse(&event) {
            Ok(QcashEvent::UtxoCreated(utxo_event)) => {
                if let Err(e) = self
                    .process_utxo_created(
                        &utxo_event.zk_proof,
                        &utxo_event.utxo,
                        utxo_event.utxo_hash,
                    )
                    .await
                {
                    warn!("Failed to process Utxo: {}", e);
                }
            }
            Ok(QcashEvent::VaultCompleted(vault_event)) => {
                info!(
                    "Vault completed for key hash: {:?}, total length: {}",
                    vault_event.key_hash, vault_event.total_length
                );
            }
            Ok(event) => {
                info!("Received event: {:?}", event);
            }
            Err(e) => {
                info!("Failed to parse event: {}", e);
            }
        }
    }
    async fn process_utxo_created(
        &self,
        zk_proof: &Pubkey,
        utxo: &Pubkey,
        utxo_hash: [u8; 32],
    ) -> Result<()> {
        let proof_data = self
            .rpc_client
            .get_account_data(zk_proof)
            .await
            .map_err(|e| anyhow!("Failed to download proof: {}", e))?;

        // ZkProof header: 8 (discriminator) + 4 (total_len) + 4 (bytes_written) = 16 bytes
        let receipt: Receipt = bincode::deserialize(&proof_data[16..])
            .map_err(|e| anyhow!("Can't parse proof: {}", e))?;

        let key_manager = self.key_manager.lock().await;
        let next_key_hash = key_manager.next_key_hash().try_into().unwrap();

        let vote = if let Err(e) = receipt.verify(IMAGE_ID) {
            info!("Proof verification failed: {}", e);
            false
        } else {
            info!("Proof verified successfully!");
            true
        };

        let recent_blockhash = self.rpc_client.get_latest_blockhash().await?;
        let tx = create_submit_attestation_transaction(
            &key_manager.current_key(),
            &key_manager.previous_key(),
            next_key_hash,
            utxo,
            utxo_hash,
            vote,
            recent_blockhash,
        )?;
        self.rpc_client.send_and_confirm_transaction(&tx).await?;

        Ok(())
    }
}

fn create_submit_attestation_transaction(
    current_key: &Keypair,
    previous_key: &Keypair,
    next_key_hash: [u8; 32],
    utxo: &Pubkey,
    utxo_hash: [u8; 32],
    vote: bool,
    recent_blockhash: solana_sdk::hash::Hash,
) -> Result<Transaction> {
    let (prover_registry_pda, _bump) =
        accounts::SubmitAttestation::prover_registry_pda(&PROGRAM_ID);
    let (ledger_pda, _bump) = accounts::SubmitAttestation::ledger_pda(&PROGRAM_ID);

    let ix = submit_attestation(
        &PROGRAM_ID,
        accounts::SubmitAttestation {
            prover: current_key.pubkey(),
            prover_old: previous_key.pubkey(),
            prover_registry: prover_registry_pda,
            ledger: ledger_pda,
            utxo: utxo.to_owned(),
            ..Default::default()
        },
        instructions::SubmitAttestation {
            next_key_hash,
            utxo_hash,
            vote,
        },
    );

    // Create a message with the instruction
    let message = Message::new(&[ix], Some(&previous_key.pubkey()));

    // Create the transaction
    let mut transaction = Transaction::new_unsigned(message);
    transaction.message.recent_blockhash = recent_blockhash;

    // Sign the transaction with the current key and the previous_key
    transaction.sign(&[current_key, previous_key], recent_blockhash);

    Ok(transaction)
}

async fn events_subscription(
    websocket_url: String,
    tx_chan: mpsc::UnboundedSender<Vec<u8>>,
) -> Result<()> {
    debug!("Websocket subscription thread starting...");

    let s = move || {
        let tx_chan = tx_chan.clone();
        let websocket_url = websocket_url.clone();
        async move {
            let client = PubsubClient::new(&websocket_url).await?;

            let (stream, _unsubscribe) = client
                .logs_subscribe(
                    RpcTransactionLogsFilter::Mentions(vec![PROGRAM_ID.to_string()]),
                    RpcTransactionLogsConfig {
                        commitment: Some(CommitmentConfig::confirmed()),
                    },
                )
                .await?;

            debug!("Websocket connected!");

            stream
                .flat_map(|e| {
                    stream::iter(e.value.logs.into_iter().filter_map(|s| {
                        if let Some(rest) = s.strip_prefix("Program data: ") {
                            BASE64_STANDARD.decode(rest).ok()
                        } else {
                            None
                        }
                    }))
                })
                .for_each(move |e| {
                    let tx_chan = tx_chan.clone();
                    async move {
                        let _ = tx_chan.send(e); // Can safely ignore the error... probably
                    }
                })
                .await;

            Ok::<_, Error>(())
        }
    };

    loop {
        let r = s().await;
        warn!("Subscription ended, reason {:?}. Reconnecting", r);
        tokio::time::sleep(Duration::from_secs(10)).await;
    }
}

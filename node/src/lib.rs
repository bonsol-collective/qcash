use std::{path::Path, time::Duration};

use anyhow::{Error, Result, anyhow};
use base64::{Engine, prelude::BASE64_STANDARD};
use futures::{StreamExt, stream};
use interface::PROGRAM_ID;
use sha3::{Digest, Keccak256};
use solana_client::rpc_config::{
    CommitmentConfig, RpcTransactionLogsConfig, RpcTransactionLogsFilter,
};
use solana_pubsub_client::nonblocking::pubsub_client::PubsubClient;
use solana_sdk::{signature::Keypair, signer::Signer};
use tokio::sync::mpsc;
use tracing::{debug, info};

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

    /// Load Solana keypair from file
    fn load_solana_key(key_file: impl AsRef<Path>) -> Result<Keypair> {
        info!("Loading Solana key from {:?}", key_file.as_ref());

        if !key_file.as_ref().exists() {
            return Err(anyhow!(
                "Solana key file not found at {:?}. Generate a key first.",
                key_file.as_ref()
            ));
        }

        let key_data = std::fs::read(key_file)?;
        let keypair = Keypair::try_from(&key_data[..])
            .map_err(|e| anyhow!("Failed to parse Solana keypair: {}", e))?;

        info!("Loaded Solana key with public key: {}", keypair.pubkey());

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
        let mut hasher = Keccak256::new();
        hasher.update(self.next_key.pubkey().as_ref());
        hasher.finalize().to_vec()
    }

    /// Get the previous Solana key
    pub fn previous_key(&self) -> &Keypair {
        &self.previous_key
    }
}

pub struct QcashNodeConfig {
    pub previous_key_file: String,
    pub current_key_file: String,
    pub next_key_file: Option<String>, //Default current-key + .next
    pub websocket_url: String,
}

pub struct QcashNode {
    key_manager: SolanaKeyManager,
    websocket_url: String,
}

impl QcashNode {
    pub fn new_from_config(config: QcashNodeConfig) -> Result<Self> {
        let current_key_file = config.current_key_file;
        let next_key_file = match config.next_key_file {
            Some(file) => file,
            None => format!("{}.next", current_key_file),
        };

        let key_manager =
            SolanaKeyManager::new(current_key_file, next_key_file, config.previous_key_file)?;

        Ok(QcashNode {
            key_manager,
            websocket_url: config.websocket_url,
        })
    }

    pub fn start(&self, tx_chan: mpsc::UnboundedSender<Vec<u8>>) {
        let websocket_url = self.websocket_url.clone();
        let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();

        // Spawn the events subscription thread
        tokio::spawn(async move {
            if let Err(e) = events_subscription(websocket_url, tx).await {
                eprintln!("Events subscription failed: {}", e);
            }
        });

        // Spawn the event processing thread
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                Self::process_event(event).await;
            }
        });
    }

    async fn process_event(event: Vec<u8>) {
        // Stub: Parse and process the event
        // parse the event object (as defined in solana/programs/qcash) and process the a ZkProofChunkWritten message, and make sure the number of bytes uploaded matches the total. AI!
        info!("Processing event: {:?}", event);
        // TODO: Implement actual parsing and processing logic
    }
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
        info!("Subscription ended, reason {:?}. Reconnecting", r);
        tokio::time::sleep(Duration::from_secs(10)).await;
    }
}

use std::{path::Path, time::Duration};

use anchor_lang::prelude::*;
use anyhow::{Error, Result, anyhow};
use base64::{Engine, prelude::BASE64_STANDARD};
use futures::{StreamExt, stream};
use interface::{accounts, instructions, submit_attestation, PROGRAM_ID};
use qcash::QcashEvent;
use risc0_zkvm::Receipt;
use sha3::{Digest, Keccak256};
use solana_client::{
    nonblocking::rpc_client::RpcClient,
    rpc_config::{RpcTransactionLogsConfig, RpcTransactionLogsFilter},
};
use solana_pubsub_client::nonblocking::pubsub_client::PubsubClient;
use solana_sdk::{
    commitment_config::CommitmentConfig, message::Message, signature::Keypair, signer::Signer,
    transaction::Transaction,
};
use tokio::sync::mpsc;
use tracing::{debug, info};

pub const IMAGE_ID: [u8; 32] = [0; 32];

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
    pub rpc_url: String,
}

pub struct QcashNode {
    key_manager: SolanaKeyManager,
    websocket_url: String,
    rpc_url: String,
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
            rpc_url: config.rpc_url,
        })
    }

    pub fn start(&self) {
        let websocket_url = self.websocket_url.clone();
        let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();

        // Spawn the events subscription thread
        tokio::spawn(async move {
            if let Err(e) = events_subscription(websocket_url, tx).await {
                eprintln!("Events subscription failed: {}", e);
            }
        });

        // Spawn the event processing thread
        let rpc_url = self.rpc_url.clone();
        let key_manager = self.key_manager.clone();
        tokio::spawn(async move {
            let rpc_client = RpcClient::new(rpc_url);
            while let Some(event) = rx.recv().await {
                Self::process_event(event, &rpc_client, &key_manager).await;
            }
        });
    }

    async fn process_event(event: Vec<u8>, rpc_client: &RpcClient, key_manager: &SolanaKeyManager) {
        // Parse the event object and process ZkProofChunkWritten messages
        match QcashEvent::parse(&event) {
            Ok(QcashEvent::ZkProofChunkWritten(chunk_event)) => {
                info!(
                    "ZK Proof chunk written: {} bytes at offset {}, total length: {}",
                    chunk_event.new_bytes_written, chunk_event.offset, chunk_event.total_length
                );

                // Verify that the number of bytes uploaded matches the total
                if chunk_event.offset + chunk_event.new_bytes_written == chunk_event.total_length {
                    info!(
                        "ZK Proof upload complete! Total bytes: {}",
                        chunk_event.total_length
                    );
                    process_verify_proof(
                        &chunk_event.zk_proof,
                        key_manager.current_key(),
                        key_manager.previous_key(),
                        &chunk_event.zk_proof,
                        rpc_client,
                    )
                    .await;
                } else {
                    info!(
                        "ZK Proof upload in progress: {}/{} bytes",
                        chunk_event.offset + chunk_event.new_bytes_written,
                        chunk_event.total_length
                    );
                }
            }
            Ok(QcashEvent::UtxoCreated(utxo_event)) => {
                info!(
                    "UTXO created: {:?}, epoch: {}",
                    utxo_event.utxo_hash, utxo_event.epoch
                );
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
}

async fn process_verify_proof(
    proof_account: &Pubkey,
    current_key: &Keypair,
    previous_key: &Keypair,
    utxo: &Pubkey,
    rpc_client: &RpcClient,
) {
    let proof_result = rpc_client.get_account_data(proof_account).await;
    match proof_result {
        Ok(data) => {
            let receipt_result: Result<Receipt> =
                bincode::deserialize(&data).map_err(|e| e.into());

            match receipt_result {
                Ok(receipt) => {
                    if let Err(e) = receipt.verify(IMAGE_ID) {
                        info!("Proof verification failed: {}", e);
                        let _ = create_submit_attestation_transaction(
                            current_key,
                            previous_key,
                            utxo,
                            rpc_client,
                            true,
                        )
                        .await;
                    } else {
                        info!("Proof verified successfully!");
                        let _ = create_submit_attestation_transaction(
                            current_key,
                            previous_key,
                            utxo,
                            rpc_client,
                            false,
                        )
                        .await;
                    }
                }
                Err(e) => info!("Failed to deserialize proof: {}", e),
            }
        }
        Err(e) => info!("Failed to download proof: {}", e),
    }
}

async fn create_submit_attestation_transaction(
    current_key: &Keypair,
    previous_key: &Keypair,
    utxo: &Pubkey,
    rpc_client: &RpcClient,
    vote: bool,
) -> Result<Vec<u8>> {
    let (prover_registry_pda, _bump) =
        accounts::SubmitAttestation::prover_registry_pda(&PROGRAM_ID);
    let (ledger_pda, _bump) = accounts::SubmitAttestation::ledger_pda(&PROGRAM_ID);

    let next_key_hash = {
        let mut hasher = Keccak256::new();
        hasher.update(current_key.pubkey().as_ref());
        hasher.finalize().to_vec()
    };

    let utxo_hash = {
        let mut hasher = Keccak256::new();
        hasher.update(utxo.as_ref());
        hasher.finalize().to_vec()
    };

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

    let recent_blockhash = rpc_client.get_latest_blockhash().await?;

    // Create a message with the instruction
    let message = Message::new(&[ix], Some(&previous_key.pubkey()));

    // Create the transaction
    let mut transaction = Transaction::new_unsigned(message);
    transaction.message.recent_blockhash = recent_blockhash;

    // Sign the transaction with the current key and the previous_key
    transaction.sign(&[current_key, previous_key], recent_blockhash);

    // Serialize the output
    let txbin = bincode::serialize(&transaction)?;

    Ok(txbin)
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

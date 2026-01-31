use std::{
    io::Write,
    path::{Path, PathBuf},
    time::Duration,
};

use anyhow::{Context, Result, anyhow};
use clap::{Parser, Subcommand};
use serde::Serialize;
use solana_sdk::pubkey::Pubkey;
use tempfile::{NamedTempFile, tempdir};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Child,
    select,
    sync::oneshot,
};
use tracing::{Level, info, warn};
use tracing_subscriber::FmtSubscriber;

#[derive(Parser)]
#[command(name = "xtask")]
#[command(about = "Qcash development tasks", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable verbose logging
    #[arg(short, long, global = true)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Start a complete test environment (validator, server, node)
    StartTestEnv {
        /// Directory for the Solana validator ledger. If not specified, a temporary directory will be used.
        #[arg(long)]
        validator_dir: Option<PathBuf>,

        /// Directory to store or load TLS certs (contains cert.pem and key.pem). If not provided, a temporary directory and self-signed certs will be created.
        #[arg(long)]
        keys_dir: Option<PathBuf>,

        /// Number of Qcash nodes to start (default: 1)
        #[arg(long, default_value = "1")]
        number_of_nodes: usize,

        /// Show Solana validator logs
        #[arg(long, default_value = "false")]
        show_solana_logs: bool,

        /// Show Qcash node logs
        #[arg(long, default_value = "false")]
        show_node_logs: bool,
    },
    /// Build the Qcash node
    BuildNode,
    /// Build the smart contract
    BuildSmartContract,
    /// Start Qcash node (uses generated test keys)
    StartNode {
        /// Show node logs
        #[arg(long, default_value = "false")]
        show_logs: bool,

        /// Directory to store the solana keys
        #[arg(long)]
        keys_dir: Option<PathBuf>,
    },
    /// Start Solana test validator
    StartValidator {
        /// Directory for the Solana validator ledger. If not specified, a temporary directory will be used.
        #[arg(long)]
        validator_dir: Option<PathBuf>,

        /// Show Solana logs
        #[arg(long, default_value = "false")]
        show_logs: bool,
    },
}

#[derive(Debug, Serialize)]
pub struct SolanaAccount {
    pubkey: String,
    account: AccountData,
    #[serde(skip)]
    temp_file: NamedTempFile,
}

#[derive(Debug, Serialize)]
struct AccountData {
    lamports: u64,
    data: Vec<String>,
    owner: String,
    executable: bool,
    #[serde(rename = "rentEpoch")]
    rent_epoch: u64,
    space: u64,
}

impl SolanaAccount {
    /// Create a new SolanaAccount with specified lamports
    pub fn new_with_lamports(pubkey: Pubkey, lamports: u64) -> Result<Self> {
        Ok(Self {
            pubkey: pubkey.to_string(),
            account: AccountData {
                lamports,
                data: vec!["".to_string(), "base64".to_string()],
                owner: "11111111111111111111111111111111".to_string(),
                executable: false,
                rent_epoch: 0,
                space: 0,
            },
            temp_file: NamedTempFile::new()?,
        })
    }

    /// Get the temporary file path if it exists
    pub fn temp_file_path(&self) -> &Path {
        self.temp_file.path()
    }

    /// Save the account to a specific file path
    pub fn save(&mut self) -> std::io::Result<()> {
        let json = serde_json::to_string_pretty(self).expect("failed to serialize account");

        self.temp_file.write_all(json.as_bytes())?;
        Ok(())
    }
}

/// Helper function to retry an operation with configurable parameters
pub async fn retry_with_backoff<F, Fut>(
    max_attempts: usize,
    delay: Duration,
    check_fn: F,
) -> Result<()>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<()>>,
{
    let mut attempts = 0;

    while attempts < max_attempts {
        attempts += 1;
        match check_fn().await {
            Ok(_) => return Ok(()),
            Err(e) => {
                if attempts < max_attempts {
                    tokio::time::sleep(delay).await;
                } else {
                    return Err(e);
                }
            }
        }
    }

    Ok(())
}

/// Build Qcash node binary
pub async fn build_node() -> Result<()> {
    use tokio::process::Command;

    info!("Building Qcash node...");
    let build_output = Command::new("cargo")
        .args(&["build", "--bin", "node"])
        .output()
        .await?;

    if !build_output.status.success() {
        return Err(anyhow::anyhow!(
            "Qcash node build failed: {}",
            String::from_utf8_lossy(&build_output.stderr)
        ));
    }

    Ok(())
}

/// Start Solana test validator with optional accounts
pub async fn start_solana_validator(
    validator_dir: &std::path::Path,
    mut accounts: Vec<SolanaAccount>,
    show_logs: bool,
) -> Result<Child> {
    use std::process::Stdio;
    use tokio::process::Command;

    info!("Starting Solana test validator...");

    // Save all accounts and collect their paths
    let mut account_args = Vec::new();

    // Now collect the paths from the saved accounts
    for account in &mut accounts {
        account.save()?;
        account_args.push("--account");
        account_args.push(&account.pubkey);
        account_args.push(account.temp_file_path().to_str().unwrap());
    }
    let validator_cmd = unsafe {
        Command::new("solana-test-validator")
            .pre_exec(|| {
                // Die if parent dies (Linux only)
                #[cfg(target_os = "linux")]
                libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL);
                Ok(())
            })
            .args(&[
                "--ledger",
                validator_dir.to_str().unwrap(),
                "--bind-address",
                "127.0.0.1",
                "--rpc-pubsub-enable-block-subscription",
                "--bpf-program",
                &interface::PROGRAM_ID.to_string(),
                "solana-qssn/target/sbpf-solana-solana/release/solana_qssn.so",
                "--quiet",
            ])
            .args(&account_args)
            .stdout(Stdio::piped())
            .spawn()?
    };

    // Wait for validator to start
    info!("Waiting for validator to start...");
    let max_attempts = 10;
    let delay = Duration::from_secs(1);

    retry_with_backoff(max_attempts, delay, || async {
        info!("Checking validator health...");
        Command::new("solana")
            .args(&[
                "ping",
                "--url",
                "http://localhost:8899",
                "-c",
                "1",
                "--commitment",
                "confirmed",
            ])
            .output()
            .await?;
        Ok(())
    })
    .await?;
    info!("Validator is ready!");

    if show_logs {
        // Spawn async task to run solana logs command
        tokio::spawn(async move {
            loop {
                let mut logs_cmd = Command::new("solana")
                    .args(&["logs", "--url", "http://localhost:8899"])
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .expect("Failed to start solana logs");

                let stdout = logs_cmd.stdout.take().unwrap();
                let stderr = logs_cmd.stderr.take().unwrap();

                let stdout_reader = BufReader::new(stdout);
                let stderr_reader = BufReader::new(stderr);

                let mut stdout_lines = stdout_reader.lines();
                let mut stderr_lines = stderr_reader.lines();

                info!("Streaming Solana logs...");

                loop {
                    select! {
                        stdout_line = stdout_lines.next_line() => {
                            if let Ok(Some(line)) = stdout_line {
                                info!("Solana logs: {}", line);
                            } else {
                                break;
                            }
                        },
                        stderr_line = stderr_lines.next_line() => {
                            if let Ok(Some(line)) = stderr_line {
                                info!("Solana logs stderr: {}", line);
                            } else {
                                break;
                            }
                        }
                    }
                }

                warn!("Solana logs disconnected, retrying...");
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        });
    }

    Ok(validator_cmd)
}

/// Start Qfire node
pub async fn start_qfire_node(
    solana_current_key: &str,
    solana_next_key: &str,
    show_logs: bool,
) -> Result<Child> {
    use std::process::Stdio;
    use tokio::process::Command;

    info!("Starting Qfire node...");

    let mut node_cmd = unsafe {
        Command::new("target/debug/node")
            .pre_exec(|| {
                // Die if parent dies (Linux only)
                #[cfg(target_os = "linux")]
                libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL);
                Ok(())
            })
            .env("RUST_LOG", "debug")
            .env("SOLANA_CURRENT_KEY_FILE", solana_current_key)
            .env("SOLANA_NEXT_KEY_FILE", solana_next_key)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?
    };

    // Spawn async tasks to log stdout and stderr
    let stdout = node_cmd.stdout.take().unwrap();
    let stderr = node_cmd.stderr.take().unwrap();

    // Create a channel to signal when login is successful
    let (tx, rx) = oneshot::channel();
    let mut tx = Some(tx);

    tokio::spawn(async move {
        let stdout_reader = BufReader::new(stdout);
        let stderr_reader = BufReader::new(stderr);

        let mut stdout_lines = stdout_reader.lines();
        let mut stderr_lines = stderr_reader.lines();

        loop {
            select! {
                stdout_line = stdout_lines.next_line() => {
                    if let Ok(Some(line)) = stdout_line {
                        if show_logs {
                            info!("Client stdout: {}", line);
                        }

                        // Check for login successful message
                        if line.contains("Login successful!") {
                            if let Some(tx) = tx.take() {
                                let _ = tx.send(());
                            }
                        }
                    } else {
                        break;
                    }
                },
                stderr_line = stderr_lines.next_line() => {
                    if let Ok(Some(line)) = stderr_line {
                        if show_logs {
                            info!("Client stderr: {}", line);
                        }
                    } else {
                        break;
                    }
                }
            }
        }
    });

    // Wait for login successful message or timeout
    let timeout = Duration::from_secs(30);
    let login_result = tokio::time::timeout(timeout, rx).await;

    match login_result {
        Ok(Ok(_)) => {
            info!("Node login successful!");
        }
        Ok(Err(_)) => {
            return Err(anyhow!("Failed to receive login confirmation"));
        }
        Err(_) => {
            return Err(anyhow!("Timeout waiting for node login"));
        }
    }

    Ok(node_cmd)
}

pub async fn build_smart_contract() -> Result<()> {
    use tokio::process::Command;

    info!("Building smart contract...");
    let build_output = Command::new("anchor")
        .args(&["build"])
        .current_dir("solana")
        .output()
        .await
        .context("Failed to build smart contract")?;

    if !build_output.status.success() {
        return Err(anyhow::anyhow!(
            "Smart contract build failed: {}",
            String::from_utf8_lossy(&build_output.stderr)
        ));
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(if cli.verbose {
            Level::DEBUG
        } else {
            Level::INFO
        })
        .finish();
    tracing::subscriber::set_global_default(subscriber).context("Failed to set up logging")?;

    match cli.command {
        Commands::BuildNode => {
            build_node().await?;
        }
        Commands::BuildSmartContract => {
            build_smart_contract().await?;
        }
        Commands::StartNode {
            show_logs,
            keys_dir,
        } => {
            // use temp_dir() to generate a temp directory if keys_dir is none, then call the keys some static name, whatever you want and concat with the dir... and implement the actual running of the node. AI!
            info!("Starting Qcash node...");
        }
        Commands::StartValidator {
            validator_dir,
            show_logs,
        } => {
            info!("Starting Solana validator...");
            let dir = validator_dir.unwrap_or_else(|| {
                let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
                temp_dir.into_path()
            });

            start_solana_validator(&dir, vec![], show_logs).await?;
        }
        Commands::StartTestEnv {
            validator_dir,
            keys_dir,
            number_of_nodes,
            show_solana_logs,
            show_node_logs,
        } => {}
    }

    Ok(())
}

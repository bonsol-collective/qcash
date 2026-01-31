use std::{
    io::{self, Write},
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use anyhow::{Context, Result, anyhow};
use clap::{Parser, Subcommand};
use colored::Colorize;
use interface::{accounts, instructions};
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig, native_token::LAMPORTS_PER_SOL, pubkey::Pubkey,
    signature::Keypair, signer::Signer,
};
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
    /// Build the browser extension
    BuildExtension,
    /// Install the Chrome extension
    InstallExtension,
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

/// Helper to create temporary Solana key files for testing
pub async fn create_test_solana_keys() -> Result<(TempKeypair, TempKeypair)> {
    let current_key_file = NamedTempFile::new()?;
    let next_key_file = NamedTempFile::new()?;

    // Generate Solana keys using the proper format
    let current_key = solana_sdk::signature::Keypair::new();
    let next_key = solana_sdk::signature::Keypair::new();

    // Save keys to files in the correct format (64 bytes each)
    std::fs::write(current_key_file.path(), current_key.to_bytes())?;
    std::fs::write(next_key_file.path(), next_key.to_bytes())?;

    Ok((
        TempKeypair {
            file: current_key_file,
            keypair: current_key,
        },
        TempKeypair {
            file: next_key_file,
            keypair: next_key,
        },
    ))
}

pub struct TempKeypair {
    pub file: NamedTempFile,
    pub keypair: Keypair,
}

impl TempKeypair {
    pub fn path(&self) -> Result<String> {
        self.file
            .path()
            .to_str()
            .map(|s| s.to_owned())
            .ok_or_else(|| anyhow!("Can't get path"))
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

/// Build browser extension
pub async fn build_extension() -> Result<()> {
    use tokio::process::Command;

    info!("Building browser extension...");

    // Build the wasm directory
    info!("Building wasm with wasm-pack...");
    let wasm_build_output = Command::new("wasm-pack")
        .args(&["build", "--target", "web"])
        .current_dir("wasm")
        .output()
        .await
        .context("Failed to build wasm with wasm-pack")?;

    if !wasm_build_output.status.success() {
        return Err(anyhow::anyhow!(
            "wasm-pack build failed: {}",
            String::from_utf8_lossy(&wasm_build_output.stderr)
        ));
    }

    // Run npm install
    info!("Running npm install...");
    let install_output = Command::new("npm")
        .args(&["install"])
        .current_dir("extension")
        .output()
        .await
        .context("Failed to run npm install")?;

    if !install_output.status.success() {
        return Err(anyhow::anyhow!(
            "npm install failed: {}",
            String::from_utf8_lossy(&install_output.stderr)
        ));
    }

    // Run npm run build
    info!("Running npm run build...");
    let build_output = Command::new("npm")
        .args(&["run", "build"])
        .current_dir("extension")
        .output()
        .await
        .context("Failed to run npm run build")?;

    if !build_output.status.success() {
        return Err(anyhow::anyhow!(
            "npm run build failed: {}",
            String::from_utf8_lossy(&build_output.stderr)
        ));
    }

    Ok(())
}

/// Install Chrome extension
pub async fn install_extension() -> Result<()> {
    // Build the extension first, just in case
    info!("Building extension before installation...");
    build_extension().await?;

    // Display formatted instructions
    println!("\n{}", "=".repeat(60));
    println!(
        "{}",
        "Chrome Extension Installation Instructions".bold().cyan()
    );
    println!("{}", "=".repeat(60));
    println!();
    println!(
        "{}",
        "1. Open Google Chrome and navigate to:".bold().yellow()
    );
    println!("   {}", "chrome://extensions".cyan());
    println!();
    println!("{}", "2. Enable Developer mode:".bold().yellow());
    println!("   {}", "Toggle the switch in the top right corner".cyan());
    println!();
    println!("{}", "3. Click 'Load unpacked':".bold().yellow());
    println!("   {}", "Select the extension/dist folder".cyan());
    println!();
    println!("{}", "4. Note the Extension ID:".bold().yellow());
    println!(
        "   {}",
        "Copy the ID displayed in the extension card".cyan()
    );
    println!();
    println!("{}", "=".repeat(60));
    println!();

    // Prompt for extension ID
    print!("{}", "Enter the Chrome Extension ID: ".bold().green());
    io::stdout().flush()?;

    let mut extension_id = String::new();
    io::stdin().read_line(&mut extension_id)?;
    let extension_id = extension_id.trim();

    if extension_id.is_empty() {
        return Err(anyhow::anyhow!("Extension ID cannot be empty"));
    }

    // Get absolute path to daemon binary
    let daemon_path = std::env::current_dir()?
        .join("target")
        .join("debug")
        .join("daemon")
        .to_string_lossy()
        .to_string();

    println!();
    println!(
        "{} {}",
        "Using daemon path:".bold().green(),
        daemon_path.cyan()
    );
    println!(
        "{} {}",
        "Using extension ID:".bold().green(),
        extension_id.cyan()
    );
    println!();

    // Load and parse com.qcash.daemon.json
    let config_path = Path::new("com.qcash.daemon.json");
    if !config_path.exists() {
        return Err(anyhow::anyhow!(
            "com.qcash.daemon.json not found in current directory"
        ));
    }

    let config_content = std::fs::read_to_string(config_path)?;
    let mut config: serde_json::Value = serde_json::from_str(&config_content)?;

    // Update allowed_origins
    if let Some(obj) = config.as_object_mut() {
        if let Some(allowed_origins) = obj
            .get_mut("allowed_origins")
            .and_then(|v| v.as_array_mut())
        {
            allowed_origins.clear();
            allowed_origins.push(serde_json::Value::String(format!(
                "chrome-extension://{}/",
                extension_id
            )));
        }

        // Update path
        obj.insert(
            "path".to_string(),
            serde_json::Value::String(daemon_path.clone()),
        );
    }

    // Write updated config back
    let updated_config = serde_json::to_string_pretty(&config)?;
    std::fs::write(config_path, &updated_config)?;

    println!(
        "{}",
        "✅ Configuration updated successfully!".bold().green()
    );
    println!();
    println!("{}", "Updated com.qcash.daemon.json:".bold().yellow());
    println!("{}", updated_config.cyan());
    println!();
    println!("{}", "=".repeat(60));
    println!("{}", "Next steps:".bold().green());
    println!("1. Reload the extension in Chrome (click the refresh icon)");
    println!("2. The native messaging host should now be configured");
    println!("3. Test the extension by opening the popup");
    println!("{}", "=".repeat(60));
    println!();

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
                "solana/target/sbpf-solana-solana/release/qcash.so",
                "--quiet",
            ])
            .args(&account_args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
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
pub async fn start_node(
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
            .env("JSON_LOG", "1")
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
                        if line.contains("connected") {
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
    let timeout = Duration::from_secs(60);
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

async fn start_test_environment(
    validator_dir: Option<PathBuf>,
    show_solana_logs: bool,
    show_node_logs: bool,
    number_of_nodes: usize,
) -> Result<()> {
    info!("Starting complete test environment...");

    // Build components
    build_smart_contract().await?;
    build_node().await?;

    // Use temporary directory if no validator directory is specified
    let validator_dir = match validator_dir {
        Some(dir) => dir,
        None => {
            let temp_validator_dir = tempfile::tempdir()?;
            temp_validator_dir.path().to_path_buf()
        }
    };

    // Create owner keypair
    let owner = Arc::new(Keypair::new());

    // Fund the owner account
    let mut validator_accounts = vec![SolanaAccount::new_with_lamports(
        owner.pubkey(),
        LAMPORTS_PER_SOL,
    )?];

    // Generate keys for all nodes before starting validator
    let mut node_solana_keys = Vec::new();
    for _i in 0..number_of_nodes {
        let solana_keys = create_test_solana_keys().await?;
        let pubkey = solana_keys.0.keypair.pubkey();
        node_solana_keys.push(solana_keys);
        validator_accounts.push(SolanaAccount::new_with_lamports(pubkey, LAMPORTS_PER_SOL)?);
    }

    // Start validator
    let mut validator_process =
        start_solana_validator(&validator_dir, validator_accounts, show_solana_logs).await?;
    info!("Solana validator started");

    // Start nodes and collect their keys
    let mut node_processes = Vec::new();
    for i in 0..number_of_nodes {
        let solana_keys = &node_solana_keys[i];

        let node_process = start_node(
            &solana_keys.0.path()?,
            &solana_keys.1.path()?,
            show_node_logs,
        )
        .await?;
        info!("Qcash node {} started", i + 1);
        info!(
            "  Solana current pubkey: {}",
            solana_keys.0.keypair.pubkey()
        );
        node_processes.push(node_process);
    }

    // Initialize the Solana program
    info!("Initializing Solana program configuration...");

    // Create RPC client
    let rpc_client = Arc::new(RpcClient::new_with_commitment(
        "http://localhost:8899".to_string(),
        CommitmentConfig::confirmed(),
    ));

    // Get PDAs
    let (program_config_pda, _program_config_bump) =
        accounts::InitProgram::program_config_pda(&interface::PROGRAM_ID);
    let (prover_registry_pda, _) =
        accounts::InitProgram::prover_registry_pda(&interface::PROGRAM_ID);

    // Create initialize program config instruction
    let initialize_program_config = interface::init_program(
        &interface::PROGRAM_ID,
        accounts::InitProgram {
            admin: owner.pubkey(),
            prover_registry: prover_registry_pda,
            program_config: program_config_pda,
            ..Default::default()
        },
        instructions::InitProgram {},
    );

    // tokio::time::sleep(Duration::from_secs(10)).await;
    // Send the transaction
    send_transaction(&rpc_client, &owner, &[initialize_program_config]).await?;

    let (ledger_pda, _bump) = accounts::InitLedger::ledger_pda(&interface::PROGRAM_ID);
    let initialize_ledger = interface::init_ledger(
        &interface::PROGRAM_ID,
        accounts::InitLedger {
            ledger: ledger_pda,
            payer: owner.pubkey(),
            ..Default::default()
        },
        instructions::InitLedger {},
    );
    send_transaction(&rpc_client, &owner, &[initialize_ledger]).await?;

    // Add nodes
    for (i, solana_keys) in node_solana_keys.iter().enumerate() {
        let next_key_hash = calculate_keccak_hash(&solana_keys.1.keypair.pubkey().to_bytes());
        let register_prover = interface::register_prover(
            &interface::PROGRAM_ID,
            accounts::RegisterProver {
                admin: owner.pubkey(),
                program_config: program_config_pda,
                prover_registry: prover_registry_pda,
                prover_pubkey: solana_keys.0.keypair.pubkey(),
            },
            instructions::RegisterProver {
                unique_id: i as u64 + 1,
                next_key_hash,
            },
        );
        send_transaction(&rpc_client, &owner, &[register_prover]).await?;
    }

    info!("Test environment is running. Press Ctrl+C to stop.");

    // Wait for Ctrl+C
    tokio::signal::ctrl_c().await?;

    // Clean up
    info!("Shutting down test environment...");
    for mut node_process in node_processes {
        node_process.kill().await?;
    }
    validator_process.kill().await?;

    Ok(())
}

pub async fn send_transaction(
    client: &RpcClient,
    owner: &Arc<Keypair>,
    instructions: &[solana_sdk::instruction::Instruction],
) -> Result<solana_sdk::signature::Signature> {
    let recent_blockhash = client.get_latest_blockhash().await?;
    let tx = solana_sdk::transaction::Transaction::new_signed_with_payer(
        instructions,
        Some(&owner.pubkey()),
        &[owner],
        recent_blockhash,
    );
    Ok(client.send_and_confirm_transaction(&tx).await?)
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
        Commands::BuildExtension => {
            build_extension().await?;
        }
        Commands::InstallExtension => {
            install_extension().await?;
        }
        Commands::StartNode {
            show_logs,
            keys_dir,
        } => {
            info!("Starting Qcash node...");

            // Generate temp directory if keys_dir is None
            let keys_path = if let Some(dir) = keys_dir {
                dir
            } else {
                let temp_dir = tempdir()?;
                temp_dir.keep()
            };

            // Create key file paths
            let current_key_path = keys_path.join("current_key.json");
            let next_key_path = keys_path.join("next_key.json");

            // Ensure the directory exists
            std::fs::create_dir_all(&keys_path)?;

            // Start the node
            start_node(
                current_key_path.to_str().unwrap(),
                next_key_path.to_str().unwrap(),
                show_logs,
            )
            .await?;
        }
        Commands::StartValidator {
            validator_dir,
            show_logs,
        } => {
            info!("Starting Solana validator...");
            let dir = validator_dir.unwrap_or_else(|| {
                let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
                temp_dir.keep()
            });

            start_solana_validator(&dir, vec![], show_logs).await?;
        }
        Commands::StartTestEnv {
            validator_dir,
            keys_dir: _,
            number_of_nodes,
            show_solana_logs,
            show_node_logs,
        } => {
            start_test_environment(
                validator_dir,
                show_solana_logs,
                show_node_logs,
                number_of_nodes,
            )
            .await?;
        }
    }

    Ok(())
}

fn calculate_keccak_hash(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    hasher.finalize().to_vec().try_into().unwrap()
}

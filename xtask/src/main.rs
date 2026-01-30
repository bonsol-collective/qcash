use std::{path::PathBuf, time::Duration};

use anyhow::{Context, Result, anyhow};
use clap::{Parser, Subcommand};
use tempfile::NamedTempFile;
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Child,
    select,
    sync::oneshot,
};
use tracing::info;

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
        cert_dir: Option<PathBuf>,

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
    /// Generate test certificates
    GenerateCerts,
    /// Build the smart contract
    BuildSmartContract,
    /// Start Qcash node (uses generated test keys)
    StartNode {
        /// Show node logs
        #[arg(long, default_value = "false")]
        show_logs: bool,

        /// Directory to store or load TLS certs (contains cert.pem and key.pem). If not provided, a temporary directory and self-signed certs will be created.
        #[arg(long)]
        cert_dir: Option<PathBuf>,
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

/// Start Qfire node
pub async fn start_qfire_node(
    pqc_key_file: &NamedTempFile,
    solana_current_key: &NamedTempFile,
    solana_next_key: &NamedTempFile,
    show_logs: bool,
    cert_path: &str,
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
            .env("SERVER_ADDR", "127.0.0.1:8041")
            .env("KEYPAIR_FILE", pqc_key_file.path().to_str().unwrap())
            .env("KEYPAIR_PASSPHRASE", "test")
            .env("CA_CERT", &format!("{}/ca-cert.pem", cert_path))
            .env(
                "SOLANA_CURRENT_KEY_FILE",
                solana_current_key.path().to_str().unwrap(),
            )
            .env(
                "SOLANA_NEXT_KEY_FILE",
                solana_next_key.path().to_str().unwrap(),
            )
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

    // Set up logging
    if cli.verbose {
        std::env::set_var("RUST_LOG", "debug");
    } else {
        std::env::set_var("RUST_LOG", "info");
    }
    tracing_subscriber::fmt::init();

    match cli.command {
        Commands::BuildNode => {
            build_node().await?;
        }
        Commands::BuildSmartContract => {
            build_smart_contract().await?;
        }
        Commands::GenerateCerts => {
            info!("Generating test certificates...");
            // Certificate generation would go here
            // For now, just log that it's a placeholder
            info!("Certificate generation is not yet implemented");
        }
        Commands::StartNode { show_logs, cert_dir } => {
            info!("Starting Qcash node...");
            // This would require setting up keys and certificates
            // For now, just log that it's a placeholder
            info!("StartNode command is not yet fully implemented");
        }
        Commands::StartValidator { validator_dir, show_logs } => {
            info!("Starting Solana validator...");
            // This would start a Solana test validator
            // For now, just log that it's a placeholder
            info!("StartValidator command is not yet fully implemented");
        }
        Commands::StartTestEnv { 
            validator_dir, 
            cert_dir, 
            number_of_nodes, 
            show_solana_logs, 
            show_node_logs 
        } => {
            info!("Starting complete test environment...");
            info!("  - Validator dir: {:?}", validator_dir);
            info!("  - Cert dir: {:?}", cert_dir);
            info!("  - Number of nodes: {}", number_of_nodes);
            info!("  - Show Solana logs: {}", show_solana_logs);
            info!("  - Show node logs: {}", show_node_logs);
            // This would orchestrate starting validator, certificates, and nodes
            // For now, just log that it's a placeholder
            info!("StartTestEnv command is not yet fully implemented");
        }
    }

    Ok(())
}

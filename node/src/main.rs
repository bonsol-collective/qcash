use node::{QcashNode, QcashNodeConfig};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env()) // Respect RUST_LOG env
        .with_timer(tracing_subscriber::fmt::time::UtcTime::rfc_3339())
        .init();

    let config = QcashNodeConfig::new_from_env().unwrap();
    let node = QcashNode::new_from_config(config).unwrap();
    node.run().await;
}

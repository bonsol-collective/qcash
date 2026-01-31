use node::{QcashNode, QcashNodeConfig};

#[tokio::main]
async fn main() {
    // Check if JSON_LOG is set to configure logging format
    if std::env::var("JSON_LOG").is_ok() {
        tracing_subscriber::fmt()
            .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
            .json()
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
            .init();
    }

    let config = QcashNodeConfig::new_from_env().unwrap();
    let node = QcashNode::new_from_config(config).unwrap();
    node.run().await;
}

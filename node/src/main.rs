fn main() {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env()) // Respect RUST_LOG env
        .with_timer(tracing_subscriber::fmt::time::UtcTime::rfc_3339())
        .init();
}

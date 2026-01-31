//! Event emitted when a loader is initialized
//!
//! This event is emitted after successfully initializing a loader account.

use anchor_lang::prelude::*;

/// Event emitted when a loader is initialized
#[event]
#[derive(Debug)]
pub struct LoaderInitialized {
    /// Loader account address
    pub loader: Pubkey,
    /// Size of the loader account
    pub size: u32,
    /// Timestamp when initialized
    pub timestamp: i64,
}

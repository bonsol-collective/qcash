pub mod constants;
pub mod error;
pub mod handlers;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use handlers::*;
pub use state::*;

declare_id!("AFdP6ozXCdssyUwFiiny7CixRRBL5KkJtxw8U3EFCWYD");

#[program]
pub mod solana_programs {
    use super::*;

    pub fn register_vault(ctx: Context<RegisterVault>, kyber_pubkey: Vec<u8>, kyber_pubkey_hash: [u8; 32]) -> Result<()> {
        register_vault::register_vault(ctx, kyber_pubkey, kyber_pubkey_hash)
    }
}

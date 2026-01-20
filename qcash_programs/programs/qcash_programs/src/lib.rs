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

    pub fn init_vault(ctx: Context<InitVault>, key_hash: [u8; 32], kyber_key_part1: Vec<u8>) -> Result<()> {
        init_vault::init_vault(ctx, key_hash, kyber_key_part1)
    }

    pub fn complete_vault(ctx: Context<CompleteVault>, kyber_key_part2: Vec<u8>) -> Result<()> {
        complete_vault::complete_vault(ctx, kyber_key_part2)
    }
}

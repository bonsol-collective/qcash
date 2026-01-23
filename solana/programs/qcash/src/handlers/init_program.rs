use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitProgram {}

pub fn init_program(ctx:Context<InitProgram>)->Result<()>{
    msg!("QCash Program Initialized");
    Ok(())
}

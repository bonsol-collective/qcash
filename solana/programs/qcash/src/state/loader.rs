use anchor_lang::prelude::*;

pub const KYBER_CIPHERTEXT_SIZE: usize = 1088;

#[account]
pub struct Loader{
    pub ciphertext: [u8;KYBER_CIPHERTEXT_SIZE]
}

impl Loader{
    pub const LEN:usize = 8 + KYBER_CIPHERTEXT_SIZE;
}

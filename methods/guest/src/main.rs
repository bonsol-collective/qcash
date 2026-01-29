#![no_main]

use risc0_zkvm::{guest::{env, sha::rust_crypto::{Digest, Sha256}}, sha::Impl};
use qcash_core::{QSPVGuestInput, QspvGuestOutput, UTXOEncryptedPayload, UTXOCommitmentHeader, HASH, derive_kyber_key};

risc0_zkvm::guest::entry!(main);

fn main(){
    let inputs:QSPVGuestInput  = env::read();

    // 1) Recover Keys from seed
    // This proves that "I know the private key corresponding to this seed"
    let my_keys = derive_kyber_key(&inputs.sender_private_key_fragment);
    // Hash the Kyber pubkey (1184 bytes) to get a 32-byte vault identifier
    let my_vault_hash = hash_pubkey(&my_keys.public);

    let mut total_in_amount:u64 = 0;

    let mut propagated_history:Vec<HASH> = Vec::new();

    for utxo in &inputs.input_utxos{

        // Integrity Check (commitment == Hash(payload))
        // This proves: "The data I am showing matches the encrypted data "
        let calculated_payload_hash = hash_payload(&utxo.payload);

        if calculated_payload_hash != utxo.header.ciphertext_commitment {
            panic!("Integrity Error: Payload does not match Commitment Header");
        }

        // Verify Ownership
        if utxo.payload.receiver_vault != my_vault_hash {
            panic!("Ownership Error: I cannot spend this UTXO. It belongs to someone else.");
        }

        // Spend list propogation
        // Union of all prev history
        for past_hash in &utxo.payload.utxo_spent_list{
            if propagated_history.contains(past_hash) {
                // If a past hash is ALREADY in our current history, it means
                // two inputs share the same ancestor. This is a double spend.
                panic!("Double Spend Detected: Ancestor collision");
            }
            propagated_history.push(*past_hash);
        }

        // mark this input as spent
        // Append current UTXO hash
        if propagated_history.contains(&utxo.header.utxo_hash){
            panic!("Double Spend Detected: UTXO is already in history (Cycle)");
        }
        propagated_history.push(utxo.header.utxo_hash);

        total_in_amount += utxo.payload.amount;
    }

    if total_in_amount < inputs.amount_to_send {
        panic!("Insufficient Funds: Input {} < Send {}", total_in_amount, inputs.amount_to_send);
    }

    let return_amount = total_in_amount - inputs.amount_to_send;

    // Output construction

    // Output A:  Receiver UTXO
    let receiver_payload = UTXOEncryptedPayload{
        amount : inputs.amount_to_send,
        is_return:false,
        receiver_vault: hash_pubkey(&inputs.receiver_pubkey),
        randomness: inputs.receiver_randomness,
        utxo_spent_list: propagated_history.clone(),
        version: 1,
    };

    // The new utxo links to the global tip
    let receiver_header = create_header(&receiver_payload,inputs.current_ledger_tip,1);

    // Output B: Return UTXO
    let return_payload = UTXOEncryptedPayload{
        amount:return_amount,
        is_return:true,
        receiver_vault: my_vault_hash,
        randomness: inputs.return_randomness,
        utxo_spent_list: propagated_history,
        version: 1,
    };

    // The second output links to the first output we just created
    let return_header = create_header(
        &return_payload,
        receiver_header.utxo_hash,
        1 // epoch
    );

    // Commit
    let output = QspvGuestOutput{
        receiver_commitment: receiver_header,
        return_commitment: return_header,
    };

    env::commit(&output);

}

/// Hash a Kyber public key (1184 bytes) to a 32-byte vault identifier
fn hash_pubkey(pubkey: &[u8; 1184]) -> [u8; 32] {
    let mut hasher = Sha256::<Impl>::new();
    hasher.update(pubkey);
    hasher.finalize().into()
}

fn hash_payload(payload: &UTXOEncryptedPayload) -> HASH {
    let mut hasher = Sha256::<Impl>::new();
    hasher.update(payload.amount.to_le_bytes());
    hasher.update(&[payload.is_return as u8]);
    hasher.update(payload.receiver_vault);
    hasher.update(payload.randomness);
    for h in &payload.utxo_spent_list { hasher.update(h); }
    hasher.finalize().into()
}

fn create_header(payload: &UTXOEncryptedPayload, prev_hash: HASH, epoch: u32) -> UTXOCommitmentHeader {
   let c_commitment = hash_payload(payload);
    let mut hasher = Sha256::<Impl>::new();
    hasher.update(c_commitment);
    hasher.update(prev_hash);
    hasher.update(epoch.to_le_bytes());
    let utxo_hash = hasher.finalize().into();

    UTXOCommitmentHeader {
        utxo_hash,
        prev_utxo_hash: prev_hash,
        ciphertext_commitment: c_commitment,
        epoch,
        kyber_ciphertext: [0u8; 1088], 
        nonce: [0u8; 12],              
        encrypted_payload: vec![],     
    }
}

// Business Source License 1.1 (BSL 1.1)
// Licensor: Bonsol Labs
// Licensed Work: QCash
// Change Date: 2030-12-31
// Change License: Apache License 2.0
// Use of this software is governed by the LICENSE file.

import * as anchor from "@coral-xyz/anchor";
import { SolanaPrograms } from "../target/types/solana_programs";

async function main() {
    // Setup Provider (Connects to localhost:8899)
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.SolanaPrograms as anchor.Program<SolanaPrograms>;

    console.log("Initializing Ledger...");

    const [ledgerPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("ledger")],
        program.programId
    );

    console.log("Ledger PDA:", ledgerPda.toBase58());

    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("program_config"),
        ],
        program.programId
    );

    const [registryPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("prover_registry"),
        ],
        program.programId
    );

    console.log("Config PDA:", configPda.toBase58());
    console.log("Registry PDA:", registryPda.toBase58());

    const ledgerAccount = await provider.connection.getAccountInfo(ledgerPda);
    if (ledgerAccount) {
        console.log("Ledger already initialized at:", ledgerPda.toBase58());
        return;
    }

    const configAccount = await provider.connection.getAccountInfo(configPda);
    if (configAccount) {
        console.log("Config already initialized at:", configPda.toBase58());
        return;
    }

    const registryAccount = await provider.connection.getAccountInfo(registryPda);
    if (registryAccount) {
        console.log("Registry already initialized at:", registryPda.toBase58());
        return;
    }

    try {
        const tx1 = await program.methods
            .initLedger()
            .accounts({
                payer: provider.wallet.publicKey,
            })
            .rpc();

        console.log("Ledger Initialized!");
        console.log("Tx Signature:", tx1);
        console.log("Ledger Address:", ledgerPda.toBase58());


        const tx2 = await program.methods
            .initProgram()
            .accounts({
                admin: provider.wallet.publicKey,
            })
            .rpc();

        console.log("Program Initialized!");
        console.log("Tx Signature:", tx2);
        console.log("Program Address:", configPda.toBase58());

        const uniqueId = new anchor.BN(1);
        const nextKeyHash = [...Buffer.from("5fd65c015910a3dc2a1dfab041acc3d4f9543dd194d774a8245eac50c291dddc", "hex")];

        const tx3 = await program.methods
            .registerProver(uniqueId, nextKeyHash)
            .accounts({
                admin: provider.wallet.publicKey,
                proverPubkey: new anchor.web3.PublicKey("RRZkKzFYCUyzzZhM6k6MggfbfzatwECKnrqJqj6e5K6"),
            })
            .rpc();

        console.log("Prover Registered!");
        console.log("Tx Signature:", tx3);
        console.log("Prover Address:", registryPda.toBase58());


    } catch (err) {
        console.error("Failed to initialize ledger:", err);
    }
}

main().then(
    () => process.exit(),
    (err) => {
        console.error(err);
        process.exit(-1);
    }
);
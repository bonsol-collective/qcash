import * as anchor from "@coral-xyz/anchor";
import { SolanaPrograms } from "../target/types/solana_programs";

async function main() {
    // 1. Setup Provider (Connects to localhost:8899)
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.SolanaPrograms as anchor.Program<SolanaPrograms>;

    console.log("Initializing Ledger...");

    // 2. Derive the Ledger PDA
    const [ledgerPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("ledger")],
        program.programId
    );

    // 3. Check if it already exists
    const account = await provider.connection.getAccountInfo(ledgerPda);
    if (account) {
        console.log("Ledger already initialized at:", ledgerPda.toBase58());
        return;
    }

    // 4. Call init_ledger
    try {
        const tx = await program.methods
            .initLedger()
            .accounts({
                payer: provider.wallet.publicKey,
            })
            .rpc();

        console.log("Ledger Initialized!");
        console.log("Tx Signature:", tx);
        console.log("Ledger Address:", ledgerPda.toBase58());
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
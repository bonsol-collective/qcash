import express from "express";
import cors from "cors";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import idl from "./idl/solana_programs.json" with {type: "json"};
import type { SolanaPrograms } from "./idl/solana_programs.ts";
import * as wasm from "qcash-wasm";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;
const connection = new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed");
const faucetKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.FAUCET_KEY!)));
const wallet = new anchor.Wallet(faucetKeypair);
const provider = new anchor.AnchorProvider(connection, wallet);
const CHUNKS_SIZE = 600;

const program = new anchor.Program<SolanaPrograms>(idl as SolanaPrograms, provider);

app.post("/airdrop", async (req, res) => {
    try {
        const { address } = req.body;

        if (!address) {
            return res.status(400).json({ error: "Missing 'address' (Vault PDA)" });
        }

        const vaultPubKey = new PublicKey(address);

        // fetch vault data
        const vaultAccount = await program.account.vault.fetch(vaultPubKey);
        console.log(vaultAccount);

        const kyberKey = Uint8Array.from(vaultAccount.kyberPubkey);
        console.log("kyberKey", kyberKey);

        // Encapsulate (KEM) using WASM
        const encapResult = wasm.encapsulate(kyberKey);

        const ciphertext = Uint8Array.from(encapResult.ciphertext);
        const sharedSecret = Uint8Array.from(encapResult.shared_secret);

        console.log("Kyber Encapsulation Success via WASM");

        const epoch = 0;

        // Construct & Encrypt Payload using WASM
        const amount = BigInt(100); // 100 tokens
        const payloadResult = wasm.encrypt_payload(
            sharedSecret,
            new Uint8Array(vaultPubKey.toBuffer()),
            amount,
            false,
        );

        const encryptedPayload = Uint8Array.from(payloadResult.encrypted_payload);
        const nonce = Uint8Array.from(payloadResult.nonce);

        console.log("Payload Encrypted successfully", payloadResult.encrypted_payload);

        // Calculate UTXO hash from the encrypted payload + nonce + epoch
        // Using sha256 of concatenated data as utxo_hash
        const hashInput = Buffer.concat([
            Buffer.from(encryptedPayload),
            Buffer.from(nonce),
            Buffer.from(new Uint32Array([epoch]).buffer)
        ]);
        const utxoHash = crypto.createHash("sha256").update(hashInput).digest();
        console.log("UTXO Hash:", utxoHash.toString("hex"));

        // Step 1: Upload Ciphertext via Loader
        const loaderKeypair = Keypair.generate();

        // - init Loader
        const initTx = await program.methods.initLoader()
            .accounts({
                loader: loaderKeypair.publicKey,
                signer: faucetKeypair.publicKey,
            })
            .signers([loaderKeypair])
            .rpc();

        console.log("Loader Initialized", initTx);

        // - Upload Chunks (split 1088 bytes into chunks)
        const totalSize = ciphertext.length;
        let offset = 0;

        while (offset < totalSize) {
            const end = Math.min(offset + CHUNKS_SIZE, totalSize);
            const chunk = ciphertext.slice(offset, end);

            await program.methods.writeLoader(offset, Buffer.from(chunk))
                .accounts({
                    loader: loaderKeypair.publicKey,
                })
                .signers([])
                .rpc();

            offset = end;
        }

        console.log("Ciphertext uploaded successfully");

        // Step 2: Call Airdrop instruction (creates UTXO and immediately finalizes)
        const [ledgerPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("ledger")],
            program.programId
        );

        // Derive the UTXO PDA (uses same 'utxo' seed as regular UTXOs)
        const [utxoPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("utxo"), utxoHash],
            program.programId
        );

        console.log("Ledger PDA:", ledgerPda.toString());
        console.log("UTXO PDA:", utxoPda.toString());

        const airdropTx = await program.methods.airdrop(
            Array.from(utxoHash) as number[],
            Buffer.from(encryptedPayload),
            Array.from(nonce) as number[],
            epoch
        )
            .accounts({
                loader: loaderKeypair.publicKey,
            })
            .signers([faucetKeypair])
            .rpc();

        console.log("Airdrop completed:", airdropTx);

        res.json({
            status: "success",
            signature: airdropTx,
            utxoPda: utxoPda.toString(),
            utxoHash: utxoHash.toString("hex"),
        });

    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err });
    }
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
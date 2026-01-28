import express from "express";
import cors from "cors";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
// import { Program, AnchorProvider, setProvider } from "@anchor-lang/core";
import idl from "./idl/solana_programs.json" with {type: "json"};
import type { SolanaPrograms } from "./idl/solana_programs.ts";
import * as wasm from "qcash-wasm";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;
const programId = process.env.PROGRAM_ID!;
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

        // Construct & Encrypt Payload using WASM
        const amount = BigInt(100); // 100 tokens
        const payloadResult = wasm.encrypt_payload(
            sharedSecret,
            new Uint8Array(vaultPubKey.toBuffer()),
            amount
        );

        const encryptedPayload = Uint8Array.from(payloadResult.encrypted_payload);
        const nonce = Uint8Array.from(payloadResult.nonce);

        console.log("Payload Encrypted successfully", payloadResult.encrypted_payload);

        // Execute Transaction
        const loaderKeypair = Keypair.generate();
        // const airdrop = await connection.requestAirdrop(loaderKeypair.publicKey, 1);
        // console.log("Airdrop", airdrop);
        const loaderSize = 8 + 1088; // Discriminator + Ciphertext size

        // Ix 1 : Upload Ciphertext
        // - init Loader
        const initTx = await program.methods.initLoader()
            .accounts({
                loader: loaderKeypair.publicKey,
                signer: faucetKeypair.publicKey,
            })
            .signers([loaderKeypair])
            .rpc();

        console.log("Loader Initialized", initTx);

        // - Upload Chunks
        // We split 1088 bytes into 2 chunks of 600 bytes 
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

        // Ix 2 : Transfer
        const [ledgerPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("ledger")],
            program.programId
        );

        const transferTx = await program.methods.transfer(Buffer.from(encryptedPayload), Array.from(nonce))
            .accounts({
                loader: loaderKeypair.publicKey,
                signer: faucetKeypair.publicKey,
            })
            .signers([faucetKeypair])
            .rpc();

        res.json({
            status: "success",
            signature: transferTx,
            loader: loaderKeypair.publicKey.toString()
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
import express from "express";
import cors from "cors";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
// import { Program, AnchorProvider, setProvider } from "@anchor-lang/core";
import idl from "../idl/solana_programs.json" with {type: "json"};
import type { SolanaPrograms } from "../idl/solana_programs.js";
import * as wasm from "qcash-wasm";

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;
const programId = process.env.PROGRAM_ID!;
const connection = new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed");
const faucetKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.FAUCET_KEYPAIR!)));
const wallet = new anchor.Wallet(faucetKeypair);
const provider = new anchor.AnchorProvider(connection, wallet);

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

        console.log("Payload Encrypted successfully", payloadResult);

        // Execute Transaction
        const loaderKeypair = Keypair.generate();
        const airdrop = await connection.requestAirdrop(loaderKeypair.publicKey, 1);
        console.log("Airdrop", airdrop);
        const loaderSize = 8 + 1088; // Discriminator + Ciphertext size

        // Ix 1 : Upload Ciphertext
        const uploadTx = await program.methods.uploadCiphertext(Array.from(ciphertext))
            .accounts({
                loader: loaderKeypair.publicKey,
                signer: faucetKeypair.publicKey,
            })
            .signers([loaderKeypair, faucetKeypair])
            .rpc();

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
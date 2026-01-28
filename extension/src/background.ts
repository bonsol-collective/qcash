import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import init, { try_decrypt_utxo } from "./wasm/qcash_wasm";
import * as anchor from "@coral-xyz/anchor";
import idl from "./idl/qcash_program.json";
import type { SolanaPrograms } from "./idl/solana_programs.ts";

// @ts-ignore - Vite provides this at build time
import wasmUrl from "./wasm/qcash_wasm_bg.wasm?url";

// const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);
const RPC_URL = import.meta.env.VITE_RPC_URL;

interface SyncedUtxo {
    index: number;
    amount: number;
    randomness: number[];
    is_return: boolean;
    header: {
        utxoHash: number[];
        prevUtxoHash: number[];
        ciphertextCommitment: number[];
        epoch: number;
        kyberCiphertext: number[];
        nonce: number[];
    }
}

let wasmInitialized = false;

// runs every 5 min
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("ledger_sync", {
        periodInMinutes: 5
    })
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "ledger_sync") {
        await syncLedger();
    }
})

// Listening to manual sync from UI
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "START_SYNC") {
        syncLedger().then(() => sendResponse("Synced"))
        return true; // keep the message channel for async response
    }
})

function createReadOnlyWallet(publicKey: PublicKey) {
    return {
        publicKey,
        signTransaction: async <T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> => { throw new Error("Read-only wallet"); },
        signAllTransactions: async <T extends Transaction | VersionedTransaction>(_txs: T[]): Promise<T[]> => { throw new Error("Read-only wallet"); },
    };
}

async function syncLedger() {
    try {
        console.log("Background Sync started")

        // Initialize WASM with explicit URL for Chrome extension context
        if (!wasmInitialized) {
            // Convert relative path to chrome-extension:// URL
            const fullWasmUrl = chrome.runtime.getURL(wasmUrl);
            console.log("Loading WASM from:", fullWasmUrl);
            await init(fullWasmUrl);
            wasmInitialized = true;
            console.log("WASM initialized in background");
        }

        // load user state
        const storage = await chrome.storage.local.get(['kyber_secret_key', 'synced_utxos']);

        if (!storage.kyber_secret_key) {
            console.log("No wallet set up. Going back to sleep.");
            return;
        }

        // preparing key for WASM
        const secretKey = new Uint8Array(storage.kyber_secret_key as number[]);

        const existingUtxos = (storage.synced_utxos || []) as SyncedUtxo[];

        // Find the highest index we have processed so far
        const lastIndex = existingUtxos.length > 0 ?
            existingUtxos[existingUtxos.length - 1].index : -1;

        // Fetch data on chain
        const connection = new Connection(RPC_URL, "confirmed");
        const dummyPubkey = Keypair.generate().publicKey;
        const readOnlyWallet = createReadOnlyWallet(dummyPubkey);
        const provider = new anchor.AnchorProvider(connection, readOnlyWallet);

        const program = new anchor.Program<SolanaPrograms>(idl, provider);

        const [ledgerPda] = PublicKey.findProgramAddressSync(
            [new TextEncoder().encode("ledger")],
            program.programId
        );

        // TODO: Use Qfire instead
        const ledgerAccount = await program.account.ledger.fetch(ledgerPda);
        const allOnChainUtxos = ledgerAccount.utxos;
        const newDecryptedUtxos: SyncedUtxo[] = [];

        // looping through the utxos we haven't read till now 
        for (let i = lastIndex + 1; i < allOnChainUtxos.length; i++) {
            const rawUtxo = allOnChainUtxos[i];
            try {
                // raw bytes fro WASM
                const ciphertext = Uint8Array.from(rawUtxo.kyberCiphertext);
                const nonce = Uint8Array.from(rawUtxo.nonce);
                const payload = Uint8Array.from(rawUtxo.encryptedPayload);

                const decrypted = try_decrypt_utxo(secretKey, ciphertext, nonce, payload, i);

                console.log(`Found UTXO! Amount: ${decrypted.amount}`);

                newDecryptedUtxos.push({
                    amount: Number(decrypted.amount),
                    is_return: decrypted.is_return,
                    randomness: Array.from(decrypted.randomness),
                    index: i,
                    header: {
                        utxoHash: Array.from(rawUtxo.utxoHash),
                        prevUtxoHash: Array.from(rawUtxo.prevUtxoHash),
                        ciphertextCommitment: Array.from(rawUtxo.ciphertextCommitment),
                        epoch: rawUtxo.epoch,
                        kyberCiphertext: Array.from(rawUtxo.kyberCiphertext),
                        nonce: Array.from(rawUtxo.nonce)
                    }
                });

            } catch (e) {
                // not our money. skipping
            }
        }

        if (newDecryptedUtxos.length > 0) {
            const updatedList = [...existingUtxos, ...newDecryptedUtxos];
            await chrome.storage.local.set({
                synced_utxos: updatedList,
                last_sync_time: Date.now(),
            })
        }

    }
    catch (err) {
        console.error("[Background] Sync Failed:", err);
    }
}

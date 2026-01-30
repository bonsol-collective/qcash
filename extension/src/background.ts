import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import init, { try_decrypt_utxo } from "./wasm/qcash_wasm";
import * as anchor from "@coral-xyz/anchor";
import idl from "./idl/qcash_program.json";
import type { SolanaPrograms } from "./idl/solana_programs.ts";

// @ts-ignore - Vite provides this at build time
import wasmUrl from "./wasm/qcash_wasm_bg.wasm?url";

const RPC_URL = import.meta.env.VITE_RPC_URL;
const HASH_SIZE = 32;

interface SyncedUtxo {
    index: number;
    amount: number;
    randomness: number[];
    is_return: boolean;
    utxoHashHex: string;
    header: {
        utxoHash: number[];
        prevUtxoHash: number[];
        ciphertextCommitment: number[];
        epoch: number;
        kyberCiphertext: number[];
        nonce: number[];
    }
    utxoSpentList: Uint8Array[];
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

    // Handle Daemon Request
    if (msg.type === "SEND_TO_DAEMON") {
        console.log("Background: Connecting to Native Daemon...");

        try {
            const port = chrome.runtime.connectNative('com.qcash.daemon');

            // forward the payload to the Rust daemon
            port.postMessage(msg.payload);

            // Listen for Daemon Process
            port.onMessage.addListener((response) => {
                console.log("Background: Received from Daemon:", response);
                sendResponse(response);
                port.disconnect();
            })

            port.onDisconnect.addListener(() => {
                if (chrome.runtime.lastError) {
                    console.error("Background: Connection Failed:", chrome.runtime.lastError.message);
                    sendResponse({ status: "error", msg: chrome.runtime.lastError.message });
                } else {
                    console.log("Background: Daemon disconnected");
                }
            })
        }
        catch (e) {
            console.error("Background: Native Messaging Error", e);
            sendResponse({ status: "error", msg: (e as Error).message });
        }

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

        // Fetch data on chain
        const connection = new Connection(RPC_URL, "confirmed");
        const dummyPubkey = Keypair.generate().publicKey;
        const readOnlyWallet = createReadOnlyWallet(dummyPubkey);
        const provider = new anchor.AnchorProvider(connection, readOnlyWallet);

        const program = new anchor.Program<SolanaPrograms>(idl, provider);

        // TODO: Use Qfire (custom RPC) for production - getProgramAccounts can be slow
        // Fetch all UTXO accounts 
        console.log("Background: Fetching UTXO accounts via getProgramAccounts...");

        // Fetch all UTXOs 
        const utxoAccounts = await program.account.utxo.all();

        console.log(`Background: Found ${utxoAccounts.length} UTXOs`);

        const newDecryptedUtxos: SyncedUtxo[] = [];

        // Process all UTXOs
        for (let i = 0; i < utxoAccounts.length; i++) {
            const accountInfo = utxoAccounts[i];
            const rawUtxo = accountInfo.account;

            try {
                // raw bytes for WASM
                const ciphertext = Uint8Array.from(rawUtxo.kyberCiphertext);
                const nonce = Uint8Array.from(rawUtxo.nonce);
                const payload = Uint8Array.from(rawUtxo.encryptedPayload);

                const decrypted = try_decrypt_utxo(secretKey, ciphertext, nonce, payload, i);

                console.log(`Background: Found UTXO! Amount: ${decrypted.amount}`);

                const flatSpentList = decrypted.utxo_spent_list; //Uint8Array
                const count = decrypted.spent_list_len;
                const reconstructedSpentList: Uint8Array[] = [];

                for (let k = 0; k < count; k++) {
                    const start = k * HASH_SIZE;
                    const end = start + HASH_SIZE;
                    reconstructedSpentList.push(flatSpentList.slice(start, end));
                }

                newDecryptedUtxos.push({
                    amount: Number(decrypted.amount),
                    is_return: decrypted.is_return,
                    randomness: Array.from(decrypted.randomness),
                    index: i,
                    utxoHashHex: Buffer.from(rawUtxo.utxoHash).toString('hex'),
                    utxoSpentList: reconstructedSpentList,
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

        await chrome.storage.local.set({
            synced_utxos: newDecryptedUtxos,
            last_sync_time: Date.now(),
        });

        console.log(`Background: Sync complete. Found ${newDecryptedUtxos.length} UTXOs for me.`);

    }
    catch (err) {
        console.error("[Background] Sync Failed:", err);
    }
}

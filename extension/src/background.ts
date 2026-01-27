import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import init,{try_decrypt_utxo} from "./wasm/qcash_wasm";
import * as anchor from "@coral-xyz/anchor";
import idl from "./idl/qcash_program.json";
import type {SolanaPrograms} from "./idl/solana_programs";

const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);
const RPC_URL = import.meta.env.VITE_RPC_URL;

interface SyncedUtxo {
    index: number;
    amount: number;
    randomness: number[];
    is_return: boolean;
}

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
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "START_SYNC") {
        syncLedger().then(() => sendResponse("Synced"))
        return true; // keep the message channel for async response
    }
})

async function syncLedger() {
    try {
        console.log("Background Sync started")

        // initializing the environment
        await init();

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
        const connection = new Connection(RPC_URL,"confirmed");
        const newKeypair = new Keypair();

        await connection.requestAirdrop(newKeypair.publicKey,2*LAMPORTS_PER_SOL);
        const wallet = new anchor.Wallet(newKeypair);
        const provider = new anchor.AnchorProvider(connection,wallet);

        const program = new anchor.Program<SolanaPrograms>(idl,provider);

        const [ledgerPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("ledger")],
            program.programId
        );

        // TODO: Use Qfire instead
        const ledgerAccount = await program.account.ledger.fetch(ledgerPda);
        const allOnChainUtxos = ledgerAccount.utxos;

        const newDecryptedUtxos = [];

        // looping through the utxos we haven't read till now 
        for(let i = lastIndex+1;i<allOnChainUtxos.length;i++){
            const rawUtxo = allOnChainUtxos[i];
            try{
                // raw bytes fro WASM
                const ciphertext = Uint8Array.from(rawUtxo.kyberCiphertext);
                const nonce = Uint8Array.from(rawUtxo.nonce);
                const payload = Uint8Array.from(rawUtxo.encryptedPayload);

                const decrypted = try_decrypt_utxo(secretKey,ciphertext,nonce,payload,i);

                console.log(`Found UTXO! Amount: ${decrypted.amount}`);

                newDecryptedUtxos.push({
                    amount:Number(decrypted.amount),
                    isReturn:decrypted.is_return,
                    randomness:Array.from(decrypted.randomness),
                    index:i
                });

            }catch(e){
                // not our money. skipping
            }
        }

        if(newDecryptedUtxos.length > 0){
            const updatedList = [...existingUtxos,...newDecryptedUtxos];
            await chrome.storage.local.set({
                synced_utxos:updatedList,
                last_sync_time:Date.now(),
            })
        }

    }
    catch (err) {
        console.error("[Background] Sync Failed:", err);
    }
}

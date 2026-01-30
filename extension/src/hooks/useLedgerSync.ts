import { useCallback, useEffect, useState } from "react"
import { Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../idl/qcash_program.json'
import type { SolanaPrograms } from '../idl/solana_programs.ts'
import { useKeyManager } from "./useKeyManager";
import * as wasm from "../wasm";

const RPC_URL = "http://127.0.0.1:8899";

export type DecryptedUtxo = {
    // Private Decrypted Data
    amount: number,
    isReturn: boolean,
    randomness: number[],
    utxoSpentList: number[][],
    // Public Data
    header: {
        utxoHash: number[],
        prevUtxoHash: number[],
        ciphertextCommitment: number[],
        epoch: number,
        kyberCiphertext: number[],
        nonce: number[]
    }
    // Using utxo_hash as unique identifier 
    utxoHashHex: string,
    index: number,
}

export const useLedgerSync = () => {
    const [balance, setBalance] = useState(0);
    const [utxos, setUtxos] = useState<DecryptedUtxo[]>([]);
    const [lastSync, setLastSync] = useState<number>(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const { keys } = useKeyManager();

    const updateState = (storedUtxos: DecryptedUtxo[]) => {
        const total = storedUtxos.reduce((acc, u) => acc + u.amount, 0);
        const sorted = [...storedUtxos].sort((a, b) => b.index - a.index);
        setBalance(total);
        setUtxos(sorted);
    };

    // Initial Load from Storage
    useEffect(() => {
        chrome.storage.local.get(['synced_utxos', 'last_sync_time'], (result) => {
            if (result.synced_utxos) {
                updateState(result.synced_utxos as DecryptedUtxo[]);
            }
            if (result.last_sync_time) {
                setLastSync(result.last_sync_time as number);
            }
        });
    }, []);

    // manual trigger 
    const syncNow = useCallback(async () => {

        if (!keys?.kyberSecretKey) {
            console.log("Skipping sync: No secret key");
            return;
        }

        setIsSyncing(true);
        console.log("Starting Sync...");

        try {
            const connection = new Connection(RPC_URL, "confirmed");
            const provider = new anchor.AnchorProvider(connection, {} as any, {});
            const program = new anchor.Program<SolanaPrograms>(idl as SolanaPrograms, provider);

            // TODO: Use Qfire (custom RPC) for production - getProgramAccounts can be slow
            // Fetch all UTXO accounts (now unified - airdrop UTXOs have votes=None)
            console.log("Fetching UTXO accounts via getProgramAccounts...");

            // Fetch all UTXOs (both regular and airdrop now use same account type)
            const utxoAccounts = await program.account.utxo.all();

            console.log(`Found ${utxoAccounts.length} UTXOs`);

            const myUtxos: DecryptedUtxo[] = [];
            const secretKeyBytes = new Uint8Array(keys.kyberSecretKey);

            // Process all UTXOs
            for (let i = 0; i < utxoAccounts.length; i++) {
                const accountInfo = utxoAccounts[i];
                const rawUtxo = accountInfo.account;

                try {
                    const ciphertext = Uint8Array.from(rawUtxo.kyberCiphertext);
                    const nonce = Uint8Array.from(rawUtxo.nonce);
                    const payload = Uint8Array.from(rawUtxo.encryptedPayload);

                    const decrypted = await wasm.try_decrypt_utxo(
                        secretKeyBytes,
                        ciphertext,
                        nonce,
                        payload,
                        i // Use index for ordering
                    );

                    const flatList = Array.from(decrypted.utxo_spent_list);
                    const reconstructedList: number[][] = [];
                    for (let j = 0; j < decrypted.spent_list_len; j++) {
                        const start = j * 32;
                        const end = start + 32;
                        reconstructedList.push(flatList.slice(start, end));
                    }

                    const utxoHashHex = Buffer.from(rawUtxo.utxoHash).toString('hex');

                    myUtxos.push({
                        amount: Number(decrypted.amount),
                        isReturn: decrypted.is_return,
                        randomness: Array.from(decrypted.randomness),
                        index: i,
                        utxoHashHex,
                        utxoSpentList: reconstructedList,
                        header: {
                            utxoHash: Array.from(rawUtxo.utxoHash),
                            prevUtxoHash: Array.from(rawUtxo.prevUtxoHash),
                            ciphertextCommitment: Array.from(rawUtxo.ciphertextCommitment),
                            epoch: rawUtxo.epoch,
                            kyberCiphertext: Array.from(rawUtxo.kyberCiphertext),
                            nonce: Array.from(rawUtxo.nonce)
                        }
                    });

                }
                catch (e) {
                    // Decryption failed = Not our UTXO. Ignore.
                }
            }

            console.log(`Sync Complete. Found ${myUtxos.length} UTXOs for me.`);

            const timestamp = Date.now();
            await chrome.storage.local.set({
                synced_utxos: myUtxos,
                last_sync_time: timestamp
            });

            updateState(myUtxos);
            setLastSync(timestamp);

        } catch (error) {
            console.error("Sync Failed:", error);
        } finally {
            setIsSyncing(false);
        }
    }, [keys]); // recreate if keys changed

    return { balance, utxos, lastSync, isSyncing, syncNow };
}
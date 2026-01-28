import { useCallback, useEffect, useState } from "react"
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../idl/qcash_program.json'
import type { SolanaPrograms } from '../idl/solana_programs.ts'
import { useKeyManager } from "./useKeyManager";
import * as wasm from "../wasm";

const PROGRAM_ID = new PublicKey("DMiW8pL1vuaRSG367zDRRkSmQM8z5kKUGU3eC9t7AFDT");
const RPC_URL = "http://127.0.0.1:8899";

export type DecryptedUtxo = {
    // Private Decrypted Data
    amount: number,
    isReturn: boolean,
    randomness: number[],
    // Public Data
    header: {
        utxoHash: number[],
        prevUtxoHash: number[],
        ciphertextCommitment: number[],
        epoch: number,
        kyberCiphertext: number[],
        nonce: number[]
    }
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

    // // load initial data & listener
    // useEffect(() => {

    //     chrome.storage.local.get(['synced_utxos', 'last_sync_time'], (result) => {
    //         updateState(result.synced_utxos as DecryptedUtxo[], result.last_sync_time as number);
    //     });

    //     const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    //         if (changes.synced_utxos) {
    //             console.log("UI received update from Background!");
    //             // Todo: Pass Date correctly
    //             updateState(changes.synced_utxos.newValue as DecryptedUtxo[], Date.now());
    //             setIsSyncing(false);
    //         }
    //     }

    //     chrome.storage.onChanged.addListener(listener);

    //     return () => chrome.storage.onChanged.removeListener(listener);

    // }, []);

    // manual trigger 
    const syncNow = useCallback(async () => {

        if (!keys?.kyberSecretKey) {
            console.log("Skipping sync: No secret key");
            return;
        }

        setIsSyncing(true);
        try {
            const connection = new Connection(RPC_URL, "confirmed");
            const provider = new anchor.AnchorProvider(connection, {} as any, {});
            const program = new anchor.Program<SolanaPrograms>(idl as SolanaPrograms, provider);

            const [ledgerPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("ledger")],
                PROGRAM_ID
            );

            // TODO: Fetching whole account can be heavy
            const ledgerAccount: any = await program.account.ledger.fetch(ledgerPda);
            const allOnChainUtxos = ledgerAccount.utxos;

            const myUtxos: DecryptedUtxo[] = [];
            const secretKeyBytes = new Uint8Array(keys.kyberSecretKey);

            // Decryption Loop
            for (let i = 0; i < allOnChainUtxos.length; i++) {
                const rawUtxo = allOnChainUtxos[i];
                try {
                    const ciphertext = Uint8Array.from(rawUtxo.kyberCiphertext);
                    const nonce = Uint8Array.from(rawUtxo.nonce);
                    const payload = Uint8Array.from(rawUtxo.encryptedPayload);

                    const decrypted = await wasm.try_decrypt_utxo(
                        secretKeyBytes,
                        ciphertext,
                        nonce,
                        payload,
                        i
                    );

                    myUtxos.push({
                        amount: Number(decrypted.amount),
                        isReturn: decrypted.is_return,
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

                    const timestamp = Date.now();
                    await chrome.storage.local.set({
                        synced_utxos: myUtxos,
                        last_sync_time: timestamp
                    });

                    updateState(myUtxos);
                    setLastSync(timestamp);

                    console.log(`Sync Complete. Found ${myUtxos.length} UTXOs.`);
                }
                catch (e) {
                    // Decryption failed = Not our UTXO. Ignore.
                }
            }


        } catch (error) {
            console.error("Sync Failed:", error);
        } finally {
            setIsSyncing(false);
        }
    }, [keys]); // recreate if keys changed

    return { balance, utxos, lastSync, isSyncing, syncNow };
}
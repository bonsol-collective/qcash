import { PublicKey } from "@solana/web3.js";
import { useSolana } from "./useSolana";
import { useLedgerSync } from "./useLedgerSync";
import { useCallback, useState } from "react";
import { useKeyManager } from "./useKeyManager.ts";
import * as wasm from '../wasm/qcash_wasm';

const PROGRAM_ID = new PublicKey("DMiW8pL1vuaRSG367zDRRkSmQM8z5kKUGU3eC9t7AFDT");

export const useTransfer = () => {
    const { connection, getProgram } = useSolana();
    const { utxos, syncNow: scanLedger } = useLedgerSync();
    const { keys } = useKeyManager();

    const [status, setStatus] = useState<"idle" | "preparing" | "proving" | "encrypting" | "ready" | "submitting" | "success" | "error">("idle");
    const [receiverKey, setReceiverKey] = useState<Uint8Array | null>(null);

    // This functions runs 2 task in parallel
    // 1) Scan the ledger
    // 2) Fetches the Receiver's pub key
    const prepareTransaction = useCallback(async (receiverAddress: string) => {
        if (!receiverAddress) {
            return;
        }
        setStatus('preparing');

        try {
            console.log("Starting Paraller Prepare");
            // Balance Update 
            const syncPromise = scanLedger();

            // Get the kyber Pubkey Key
            const keyPromise = (async () => {
                const program = await getProgram();
                const vaultPda = new PublicKey(receiverAddress);

                const account = await program.account.vault.fetch(vaultPda);

                return new Uint8Array(account.kyberPubkey);
            })();

            const [_synced, kyberPubkey] = await Promise.all([syncPromise, keyPromise]);

            if (!kyberPubkey) {
                throw new Error("Receiver key not found");
            }

            setReceiverKey(kyberPubkey);
            setStatus("ready");

        } catch (err) {
            console.error("Prep failed:", err);
            setStatus("error");
        }


    }, [connection, scanLedger]);

    async function getKyberKeyHash(kyberKey: number[] | Uint8Array): Promise<number[]> {
        const keyBytes = new Uint8Array(kyberKey);
        const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes);
        return Array.from(new Uint8Array(hashBuffer));
    }

    // spend everthing from last change
    const selectInputs = useCallback(() => {
        // Descending order 
        const sorted = [...utxos].sort((a, b) => b.index - a.index);

        const selectedInputs = [];
        let totalAvailable = 0;

        for (const utxo of sorted) {
            selectedInputs.push(utxo);
            totalAvailable += utxo.amount;

            // when we hit a return UTXO , that means everything before that is already spend
            if (utxo.isReturn) {
                break;
            }
        }

        return {
            // reverse the order to - oldest first
            inputs: selectedInputs.reverse(),
            totalAmount: totalAvailable,
        }
    }, [utxos]);

    const fetchLedgerState = async () => {
        const program = await getProgram();
        const [ledgerPda] = PublicKey.findProgramAddressSync(
            [new TextEncoder().encode("ledger")],
            program.programId
        );
        const ledgerAccount = await program.account.ledger.fetch(ledgerPda);

        const tip = new Uint8Array(ledgerAccount.lastValidUtxoHash);

        return {
            tip,
            epoch: 0,
        }
    }

    const executeSend = async (amountToSend: number, receiverVault: string) => {

        // we are settting receiverKey in prepareTransaction
        if (!receiverKey || !keys?.kyberSecretKey) {
            throw new Error("Receiver key or secret key not found");
        }
        try {

            const kyberKeyHash = await getKyberKeyHash(keys.kyberPublicKey);
            const [myVaultPda, myVaultBump] = PublicKey.findProgramAddressSync(
                [Buffer.from("vault"), Buffer.from(kyberKeyHash)],
                PROGRAM_ID
            );
            const { inputs, totalAmount } = selectInputs();

            if (totalAmount < amountToSend) {
                throw new Error(`Insufficient Funds. Have ${totalAmount}, need ${amountToSend}`);
            }

            const returnAmount = totalAmount - amountToSend;

            console.log(`Selected ${inputs.length} UTXOs. Total: ${totalAmount}`);

            const { tip: currentTip, epoch: currentEpoch } = await fetchLedgerState();

            // Encrypting Payload (WASM)
            setStatus('encrypting');

            console.log("Receiver Vault PDA:", receiverVault);
            console.log("My Vault PDA:", myVaultPda.toBase58());

            const receiverOutput = await wasm.prepare_output(
                receiverKey,                                         // raw Uint8Array bytes
                new Uint8Array(new PublicKey(receiverVault).toBuffer()), // receiver's vault PDA
                BigInt(amountToSend),
                currentTip,
                currentEpoch,
                false
            );

            // This hash will links to the receiver UTXO
            const prevHash = new Uint8Array(receiverOutput.utxo_hash);

            // For return output, use sender's own vault PDA
            const returnOutput = await wasm.prepare_output(
                new Uint8Array(keys.kyberPublicKey),
                new Uint8Array(new PublicKey(myVaultPda).toBuffer()), // sender's vault PDA
                BigInt(returnAmount),
                prevHash,
                currentEpoch,
                true
            )

            setStatus("proving");
            console.log("Generating ZK Proof");

            // Proof inputs 
            const proofInputs = {
                // Have to provide the secret key 
                sender_private_key_fragment: Array.from(keys.seed),
                input_utxos: inputs.map(u => ({
                    header: {
                        utxo_hash: u.header.utxoHash,
                        prev_utxo_hash: u.header.prevUtxoHash,
                        ciphertext_commitment: u.header.ciphertextCommitment,
                        epoch: u.header.epoch,
                        kyber_ciphertext: u.header.kyberCiphertext,
                        nonce: u.header.nonce,
                        encrypted_payload: [] // our guest code, never reads this field. it only checks the payload(plaintext) hashes to the ciphertextCommitment. so this is ignored we can skip this for now.
                    },
                    payload: {
                        amount: u.amount,
                        is_return: u.isReturn,
                        receiver_vault: Array.from(new PublicKey(keys.vaultPda).toBuffer()),
                        randomness: u.randomness,
                        // Convert Uint8Array[] to number[][]
                        // // JSON.stringify handles number[] correctly as [1,2,3], 
                        // but handles Uint8Array as {"0":1, "1":2} which breaks Rust hash logic.
                        utxo_spent_list: u.utxoSpentList.map(hash => Array.from(hash)),
                        version: 1
                    }
                })),
                solana_program_id: Array.from(PROGRAM_ID.toBuffer()),
                vault_bump: myVaultBump,
                amount_to_send: amountToSend,
                receiver_pubkey: Array.from(receiverKey),
                receiver_randomness: Array.from(receiverOutput.randomness),
                return_randomness: Array.from(returnOutput.randomness),
                current_ledger_tip: Array.from(currentTip),
                receiver_vault: Array.from(new PublicKey(receiverVault).toBuffer()),
            };

            console.log("Proof Inputs:", proofInputs);

            // we need to pass the inputs to the Native Daemon via Native Messaging
            const nativeRequest = {
                action: "Send",
                payload: {
                    receiver: receiverVault,
                    amount: amountToSend,
                    proof_inputs: proofInputs,
                }
            }


            return new Promise((res, rej) => {
                chrome.runtime.sendMessage({ type: "SEND_TO_DAEMON", payload: nativeRequest }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Messaging Error:", chrome.runtime.lastError);
                        setStatus("error");
                        return rej(chrome.runtime.lastError);
                    }

                    // Handle case where background script returns error explicitly
                    if (!response || response.status === "error") {
                        console.error("Daemon/Background Error:", response?.msg);
                        setStatus("error");
                        return rej(response?.msg || "Unknown error from daemon");
                    }

                    if (response.status === "success") {
                        const { proof, proving_time_secs } = response.data;
                        console.log(`Proof generated in ${proving_time_secs}s`);
                        console.log("Proof generated", proof);

                        setStatus("success");
                        // submitToSolana(proof, receiverOutput, returnOutput);
                        res(response.data);
                    } else {
                        const errorMsg = response.data?.msg || response.msg || "Unknown daemon error";
                        console.error("Daemon Error:", errorMsg);
                        setStatus("error");
                        rej(errorMsg);
                    }

                })
            })


        } catch (e) {
            console.error(e);
            setStatus("error");
            throw e; // rethrow the error 
        }

    }

    // const submitToSolana = async (proof: string, receiverOutput: any, returnOutput: any) => {
    //     setStatus("submitting");

    //     try {
    //         const program = await getProgram();

    //         // convert base64 Proof to Buffer
    //         const proofBytes = Buffer.from(proof, "base64");

    //         const [ledgerPda] = PublicKey.findProgramAddressSync(
    //             [new TextEncoder().encode("ledger")],
    //             program.programId
    //         );

    //         // formatting them for Anchor.
    //         const receiverUTXO = {
    //             utxoHash: Array.from(receiverOutput.utxo_hash),
    //             prevUtxoHash: Array.from(receiverOutput.prev_utxo_hash),
    //             ciphertextCommitment: Array.from(receiverOutput.commitment),
    //             epoch: receiverOutput.epoch,
    //             kyberCiphertext: Array.from(receiverOutput.kyber_ciphertext),
    //             nonce: Array.from(receiverOutput.nonce),
    //             encryptedPayload: Array.from(receiverOutput.encrypted_payload)
    //         };

    //         const returnUTXO = {
    //             utxoHash: Array.from(returnOutput.utxo_hash),
    //             prevUtxoHash: Array.from(returnOutput.prev_utxo_hash),
    //             ciphertextCommitment: Array.from(returnOutput.commitment),
    //             epoch: returnOutput.epoch,
    //             kyberCiphertext: Array.from(returnOutput.kyber_ciphertext),
    //             nonce: Array.from(returnOutput.nonce),
    //             encryptedPayload: Array.from(returnOutput.encrypted_payload)
    //         };

    //         console.log("Submitting transaction to Solana...");

    //         setStatus("success");

    //         scanLedger();

    //     } catch (err) {
    //         console.error("Submission failed:", err);
    //         setStatus("error");
    //         throw err;
    //     }

    //     setStatus("success");
    // };


    return { prepareTransaction, status, receiverKey, utxos, executeSend }

}
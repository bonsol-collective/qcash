import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useSolana } from "./useSolana";
import { useLedgerSync } from "./useLedgerSync";
import { useCallback, useState } from "react";
import idl from "../idl/qcash_program.json";
import type { SolanaPrograms } from "../idl/solana_programs.ts"
import { useKeyManager } from "./useKeyManager.ts";
import * as wasm from '../wasm/qcash_wasm';

const PROGRAM_ID = new PublicKey("DMiW8pL1vuaRSG367zDRRkSmQM8z5kKUGU3eC9t7AFDT");

export const useTransfer = () => {
    const { connection } = useSolana();
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
                const provider = new anchor.AnchorProvider(connection, {} as any);
                const program = new anchor.Program<SolanaPrograms>(idl as SolanaPrograms, provider);
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

    // spend everthing from last change
    const selectInputs = () => {
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
    }

    const executeSend = async (amountToSend: number, receiverVault: string) => {
        if (!receiverKey || !keys?.kyberSecretKey) {
            throw new Error("Receiver key or secret key not found");
        }
        try {

            const { inputs, totalAmount } = selectInputs();

            if (totalAmount < amountToSend) {
                throw new Error(`Insufficient Funds. Have ${totalAmount}, need ${amountToSend}`);
            }

            const returnAmount = totalAmount - amountToSend;

            // TODO: fetch the current ledger tip 
            const currentTip = new Uint8Array(32).fill(0);
            const currentEpoch = 0;

            // Encrypting Payload (WASM)
            setStatus('encrypting');

            const receiverOutput = await wasm.prepare_output(
                receiverKey, // raw Uint8Array bytes
                BigInt(amountToSend),
                currentTip,
                currentEpoch,
                false
            );

            // This hash will links to the receiver UTXO
            const prevHash = new Uint8Array(receiverOutput.utxo_hash);

            const returnOutput = await wasm.prepare_output(
                keys.kyberPublicKey,
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
                        encrypted_payload: [] // TODO:Empty vec 
                    },
                    payload: {
                        amount: u.amount,
                        is_return: u.isReturn,
                        receiver_vault: Array.from(new PublicKey(keys.vaultPda).toBuffer()), // Todo: CHECK IT
                        randomness: u.randomness,
                        utxo_spent_list: [], // TODO: Track history
                        version: 1
                    }
                })),
                amount_to_send: amountToSend,
                receiver_pubkey: Array.from(receiverKey),
                receiver_randomness: Array.from(receiverOutput  .randomness),
                return_randomness: Array.from(returnOutput.randomness),
                current_ledger_tip: Array.from(currentTip),
            };

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
                chrome.runtime.sendNativeMessage('com.qcash.daemon', nativeRequest, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Native Messaging Error:", chrome.runtime.lastError);
                        setStatus("error");
                        return rej(chrome.runtime.lastError);
                    }

                    if (response.status === "success") {
                        const { proof, proving_time_secs } = response.data;
                        console.log(`Proof generated in ${proving_time_secs}s`);

                        submitToSolana(proof, receiverOutput, returnOutput);
                        res(response.data);
                    } else {
                        setStatus("error");
                        rej(response.data.msg);
                    }

                })
            })

            setStatus("success");

        } catch (e) {
            console.error(e);
            setStatus("error");
        }

    }

    const submitToSolana = async (proof: string, receiverOutput: any, returnOutput: any) => {
        setStatus("submitting");

        try {
            // TODO: Need to fix this also, add that it in a Hook
            const provider = new anchor.AnchorProvider(connection, {} as any);
            const program = new anchor.Program<SolanaPrograms>(idl as SolanaPrograms, provider);

            // convert base64 Proof to Buffer
            const proofBytes = Buffer.from(proof, "base64");

            const [ledgerPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("ledger")],
                program.programId
            );

            // formatting them for Anchor.
            const receiverUTXO = {
                utxoHash: Array.from(receiverOutput.utxo_hash),
                prevUtxoHash: Array.from(receiverOutput.prev_utxo_hash),
                ciphertextCommitment: Array.from(receiverOutput.commitment),
                epoch: receiverOutput.epoch,
                kyberCiphertext: Array.from(receiverOutput.kyber_ciphertext),
                nonce: Array.from(receiverOutput.nonce),
                encryptedPayload: Array.from(receiverOutput.encrypted_payload)
            };

            const returnUTXO = {
                utxoHash: Array.from(returnOutput.utxo_hash),
                prevUtxoHash: Array.from(returnOutput.prev_utxo_hash),
                ciphertextCommitment: Array.from(returnOutput.commitment),
                epoch: returnOutput.epoch,
                kyberCiphertext: Array.from(returnOutput.kyber_ciphertext),
                nonce: Array.from(returnOutput.nonce),
                encryptedPayload: Array.from(returnOutput.encrypted_payload)
            };

            console.log("Submitting transaction to Solana...");

            setStatus("success");

            scanLedger();

        } catch (err) {
            console.error("Submission failed:", err);
            setStatus("error");
            throw err;
        }

        setStatus("success");
    };


    return { prepareTransaction, status, receiverKey, utxos }

}

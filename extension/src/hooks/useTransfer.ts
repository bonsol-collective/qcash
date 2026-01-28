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

// interface QSPVGuestInput {
//     sender_private_key_fragment:[u8;32],
//     input_utxos:Vec<DecryptedInput>,
//     // We use serde_arrays because default serde struggles with array > 32 bytes
//     #[serde(with = "serde_arrays")]
//     receiver_pubkey:KyberPubKey,
//     amount_to_send:u64,
//     receiver_randomness:[u8;32],
//     return_randomness:[u8;32],
//     current_ledger_tip:HASH,
// }

export const useTransfer = () => {
    const { connection } = useSolana();
    const { utxos, syncNow: scanLedger } = useLedgerSync();
    const { keys } = useKeyManager();

    const [status, setStatus] = useState<"idle" | "preparing" | "proving" | "encrypting" | "submitting" | "error">("idle");
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

            const [synced, kyberPubkey] = await Promise.all([syncPromise, keyPromise]);

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
        setStatus("proving");

        const { inputs, totalAmount } = selectInputs();

        if (totalAmount < amountToSend) {
            throw new Error(`Insufficient Funds. Have ${totalAmount}, need ${amountToSend}`);
        }

        const returnAmount = totalAmount - amountToSend;

        // Proof inputs 
        const proofInputs = {
            // Have to provide the secret key 
            sender_private_key_fragment: Array.from(keys.seedPhrase),
            input_utxos: inputs.map(u => ({

            })),
            amount_to_send: amountToSend,
            receiver_pubkey: Array.from(receiverKey),
        };

        // Client Side Proving
        // Need to be implemented here
        console.log("Generating ZK Proof");

        // Encrypting Payload (WASM)
        setStatus('encrypting');

        // 1) Receiver Output 
        const encapReceiver = wasm.encapsulate(receiverKey);
        const payloadReceiver = wasm.encrypt_payload(
            encapReceiver.shared_secret,
            new PublicKey(receiverVault).toBuffer(),
            BigInt(amountToSend),
            false,
        );

        // 2) Return Output (To Self)
        const myPubkeyBytes = keys.kyberSecretKey;
        const encapReturn = wasm.encapsulate(new Uint8Array(myPubkeyBytes));
        const payloadReturn = wasm.encrypt_payload(
            encapReturn.shared_secret,
            new PublicKey("My VAULT PDA").toBuffer(),
            BigInt(returnAmount),
            true,
        )

        setStatus("submitting");

        // send the proof on chain

    }

    return { prepareTransaction, status, receiverKey, utxos }

}

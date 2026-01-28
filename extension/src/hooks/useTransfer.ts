import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useSolana } from "./useSolana";
import { useLedgerSync } from "./useLedgerSync";
import { useCallback, useState } from "react";
import idl from "../idl/qcash_program.json";
import type { SolanaPrograms } from "../idl/solana_programs.ts"

const PROGRAM_ID = new PublicKey("DMiW8pL1vuaRSG367zDRRkSmQM8z5kKUGU3eC9t7AFDT");

export const useTransfer = () => {
    const { connection } = useSolana();
    const { utxos, syncNow: scanLedger } = useLedgerSync();

    const [status, setStatus] = useState<"idle" | "preparing" | "ready" | "error">("idle");
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
    const selectInputs = (amountNeeded: number) => {
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

        if (totalAvailable < amountNeeded) {
            throw new Error(`Insufficient Funds. Available: ${totalAvailable}, Needed: ${amountNeeded}`);
        }

        return {
            // reverse the order to - oldest first
            inputs: selectedInputs.reverse(),
            totalAmount: totalAvailable,
        }
    }

    return { prepareTransaction, status, receiverKey, utxos }

}

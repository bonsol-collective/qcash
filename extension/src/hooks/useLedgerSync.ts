import { useCallback, useEffect, useState } from "react"
import { useKeyManager } from "./useKeyManager";
import * as wasm from "../wasm";
import { syncUtxos, type DecryptedUtxo, type SyncResult } from "../utils/syncUtils";

// Re-export types for consumers
export type { DecryptedUtxo, UtxoStatus } from "../utils/syncUtils";

export const useLedgerSync = () => {
    const [confirmedBalance, setConfirmedBalance] = useState(0);
    const [pendingBalance, setPendingBalance] = useState(0);
    const [utxos, setUtxos] = useState<DecryptedUtxo[]>([]);
    const [lastSync, setLastSync] = useState<number>(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const { keys } = useKeyManager();

    const updateState = (result: SyncResult) => {
        setConfirmedBalance(result.confirmedBalance);
        setPendingBalance(result.pendingBalance);
        // Sort by index descending (newest first)
        const sorted = [...result.utxos].sort((a, b) => b.index - a.index);
        setUtxos(sorted);
    };

    // Initial Load from Storage
    useEffect(() => {
        chrome.storage.local.get(['synced_utxos', 'confirmed_balance', 'pending_balance', 'last_sync_time'], (result) => {
            if (result.synced_utxos) {
                setUtxos(result.synced_utxos as DecryptedUtxo[]);
            }
            if (typeof result.confirmed_balance === 'number') {
                setConfirmedBalance(result.confirmed_balance);
            }
            if (typeof result.pending_balance === 'number') {
                setPendingBalance(result.pending_balance);
            }
            if (result.last_sync_time) {
                setLastSync(result.last_sync_time as number);
            }
        });
    }, []);

    // Sync UTXOs
    const syncNow = useCallback(async () => {
        if (!keys?.kyberSecretKey) {
            console.log("Skipping sync: No secret key");
            return;
        }

        setIsSyncing(true);
        console.log("Starting Sync...");

        try {
            const secretKeyBytes = new Uint8Array(keys.kyberSecretKey);

            // Use shared sync utility
            const result = await syncUtxos(
                secretKeyBytes,
                wasm.try_decrypt_utxo
            );

            const timestamp = Date.now();
            await chrome.storage.local.set({
                synced_utxos: result.utxos,
                confirmed_balance: result.confirmedBalance,
                pending_balance: result.pendingBalance,
                last_sync_time: timestamp
            });

            updateState(result);
            setLastSync(timestamp);

        } catch (error) {
            console.error("Sync Failed:", error);
        } finally {
            setIsSyncing(false);
        }
    }, [keys]);

    // Total balance (confirmed only for display, pending shown separately)
    const balance = confirmedBalance;

    return {
        balance,
        confirmedBalance,
        pendingBalance,
        utxos,
        lastSync,
        isSyncing,
        syncNow
    };
}
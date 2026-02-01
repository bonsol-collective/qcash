// Business Source License 1.1 (BSL 1.1)
// Licensor: Bonsol Labs Inc.
// Licensed Work: QCash
// Change Date: 2030-12-31
// Change License: Apache License 2.0
// Use of this software is governed by the LICENSE file.

import { Buffer } from "buffer";
import init, { try_decrypt_utxo } from "./wasm/qcash_wasm";
import { syncUtxos } from "./utils/syncUtils";

// @ts-ignore - Vite provides this at build time
import wasmUrl from "./wasm/qcash_wasm_bg.wasm?url";

// Make Buffer available globally for Anchor (which expects Node.js Buffer)
(globalThis as any).Buffer = Buffer;

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

            // Listen for Daemon responses (may receive multiple progress updates)
            port.onMessage.addListener((response) => {
                console.log("Background: Received from Daemon:", response);

                // Handle progress messages (keep-alive heartbeats)
                if (response.status === "progress") {
                    console.log("Background: Proof in progress:", response.data?.msg);
                    // Don't disconnect - more messages coming
                    return;
                }

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

async function syncLedger() {
    try {
        console.log("Background: Sync started")

        // Initialize WASM with explicit URL for Chrome extension context
        if (!wasmInitialized) {
            const fullWasmUrl = chrome.runtime.getURL(wasmUrl);
            console.log("Loading WASM from:", fullWasmUrl);
            await init(fullWasmUrl);
            wasmInitialized = true;
            console.log("WASM initialized in background");
        }

        // load user state
        const storage = await chrome.storage.local.get(['kyber_secret_key']);

        if (!storage.kyber_secret_key) {
            console.log("No wallet set up. Going back to sleep.");
            return;
        }

        // preparing key for WASM
        const secretKey = new Uint8Array(storage.kyber_secret_key as number[]);

        // Use shared sync utility
        const result = await syncUtxos(secretKey, try_decrypt_utxo);

        await chrome.storage.local.set({
            synced_utxos: result.utxos,
            confirmed_balance: result.confirmedBalance,
            pending_balance: result.pendingBalance,
            last_sync_time: Date.now(),
        });

        console.log(`Background: Sync complete. ${result.utxos.length} UTXOs (${result.confirmedBalance} confirmed, ${result.pendingBalance} pending)`);

    }
    catch (err) {
        console.error("[Background] Sync Failed:", err);
    }
}



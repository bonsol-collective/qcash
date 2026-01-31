import { Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../idl/qcash_program.json';
import type { SolanaPrograms } from '../idl/solana_programs';
import { Buffer } from 'buffer';

const RPC_URL = "http://127.0.0.1:8899";

// UTXO Status based on voting
export type UtxoStatus = 'finalized' | 'pending' | 'voted';

export interface UtxoHeader {
    utxoHash: number[];
    prevUtxoHash: number[];
    ciphertextCommitment: number[];
    epoch: number;
    kyberCiphertext: number[];
    nonce: number[];
}

export interface DecryptedUtxo {
    // Private Decrypted Data
    amount: number;
    isReturn: boolean;
    randomness: number[];
    utxoSpentList: number[][];
    // Public Data
    header: UtxoHeader;
    // Status based on voting
    status: UtxoStatus;
    voteCount: number;
    // Identifiers
    utxoHashHex: string;
    index: number;
}

export interface SyncResult {
    utxos: DecryptedUtxo[];
    confirmedBalance: number;
    pendingBalance: number;
    totalBalance: number;
}

// Helper to determine UTXO status from votes field
function determineUtxoStatus(votes: any): { status: UtxoStatus; voteCount: number } {
    // votes = null → airdrop (finalized)
    if (votes === null || votes === undefined) {
        return { status: 'finalized', voteCount: 0 };
    }

    // votes is an array of ProverVote
    // Check if any vote has a non-zero prover_id (used vote)
    const usedVotes = votes.filter((vote: any) =>
        vote && vote.proverId && vote.proverId.toString() !== '0'
    );

    if (usedVotes.length === 0) {
        // No votes yet → pending
        return { status: 'pending', voteCount: 0 };
    } else {
        // Has votes → voted (may need threshold check)
        return { status: 'voted', voteCount: usedVotes.length };
    }
}

// Create a read-only provider for syncing
function createReadOnlyProvider(connection: Connection): anchor.AnchorProvider {
    return new anchor.AnchorProvider(connection, {} as any, {
        preflightCommitment: "confirmed"
    });
}

// Shared sync function that can be used by both frontend hook and background
export async function syncUtxos(
    secretKey: Uint8Array,
    tryDecryptUtxo: (secretKey: Uint8Array, ciphertext: Uint8Array, nonce: Uint8Array, payload: Uint8Array, index: number) => any
): Promise<SyncResult> {
    const connection = new Connection(RPC_URL, "confirmed");
    const provider = createReadOnlyProvider(connection);
    const program = new anchor.Program<SolanaPrograms>(idl as SolanaPrograms, provider);

    // Fetch all UTXOs via getProgramAccounts
    console.log("Sync: Fetching UTXO accounts...");
    const utxoAccounts = await program.account.utxo.all();
    console.log(`Sync: Found ${utxoAccounts.length} UTXOs`);

    const myUtxos: DecryptedUtxo[] = [];

    for (let i = 0; i < utxoAccounts.length; i++) {
        const accountInfo = utxoAccounts[i];
        const rawUtxo = accountInfo.account;

        try {
            const ciphertext = Uint8Array.from(rawUtxo.kyberCiphertext);
            const nonce = Uint8Array.from(rawUtxo.nonce);
            const payload = Uint8Array.from(rawUtxo.encryptedPayload);

            const decrypted = tryDecryptUtxo(secretKey, ciphertext, nonce, payload, i);

            // Reconstruct spent list
            const flatList = Array.from(decrypted.utxo_spent_list) as number[];
            const reconstructedList: number[][] = [];
            for (let j = 0; j < decrypted.spent_list_len; j++) {
                const start = j * 32;
                const end = start + 32;
                reconstructedList.push(flatList.slice(start, end));
            }

            // Determine status from votes
            const { status, voteCount } = determineUtxoStatus(rawUtxo.votes);
            const utxoHashHex = Buffer.from(rawUtxo.utxoHash).toString('hex');

            myUtxos.push({
                amount: Number(decrypted.amount),
                isReturn: decrypted.is_return,
                randomness: Array.from(decrypted.randomness),
                index: i,
                utxoHashHex,
                utxoSpentList: reconstructedList,
                status,
                voteCount,
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
            // Decryption failed = Not our UTXO. Ignore.
        }
    }

    // Calculate balances
    const confirmedBalance = myUtxos
        .filter(u => u.status === 'finalized')
        .reduce((acc, u) => acc + u.amount, 0);

    const pendingBalance = myUtxos
        .filter(u => u.status === 'pending' || u.status === 'voted')
        .reduce((acc, u) => acc + u.amount, 0);

    console.log(`Sync: Complete. ${myUtxos.length} UTXOs (${confirmedBalance} confirmed, ${pendingBalance} pending)`);

    return {
        utxos: myUtxos,
        confirmedBalance,
        pendingBalance,
        totalBalance: confirmedBalance + pendingBalance
    };
}

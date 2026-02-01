import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from '../idl/qcash_program.json';
import type { SolanaPrograms } from '../idl/solana_programs';
import { Buffer } from 'buffer';

const RPC_URL = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("DMiW8pL1vuaRSG367zDRRkSmQM8z5kKUGU3eC9t7AFDT");

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
// MIN_ATTESTATIONS = 1 (matches the Solana program constant)
const MIN_ATTESTATIONS = 1;

function determineUtxoStatus(votes: any): { status: UtxoStatus; voteCount: number } {
    // votes = null → airdrop (finalized without voting)
    if (votes === null || votes === undefined) {
        return { status: 'finalized', voteCount: 0 };
    }

    // votes is an array of ProverVote
    // Count valid votes (prover_id != 0 AND is_valid = true)
    const validVotes = votes.filter((vote: any) =>
        vote && vote.proverId && vote.proverId.toString() !== '0' && vote.isValid === true
    );

    const voteCount = validVotes.length;

    if (voteCount >= MIN_ATTESTATIONS) {
        // Threshold met → finalized
        return { status: 'finalized', voteCount };
    } else if (voteCount > 0) {
        // Has votes but threshold not met → voted
        return { status: 'voted', voteCount };
    } else {
        // No votes yet → pending
        return { status: 'pending', voteCount: 0 };
    }
}

function isGenesisHash(hash: number[] | Uint8Array): boolean {
    return Array.from(hash).every(byte => byte === 0);
}

function deriveUtxoPda(utxoHash: Uint8Array): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("utxo"), utxoHash],
        PROGRAM_ID
    );
    return pda;
}

function deriveLedgerPda(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("ledger")],
        PROGRAM_ID
    );
    return pda;
}

// Create a read-only provider for syncing
function createReadOnlyProvider(connection: Connection): anchor.AnchorProvider {
    return new anchor.AnchorProvider(connection, {} as any, {
        preflightCommitment: "confirmed"
    });
}

// Shared sync function that can be used by both frontend hook and background
// Uses linked list traversal: starts from ledger head, follows prevUtxoHash
// Stops when finding a finalized return UTXO or reaching genesis
export async function syncUtxos(
    secretKey: Uint8Array,
    tryDecryptUtxo: (secretKey: Uint8Array, ciphertext: Uint8Array, nonce: Uint8Array, payload: Uint8Array, index: number) => any
): Promise<SyncResult> {
    const connection = new Connection(RPC_URL, "confirmed");
    const provider = createReadOnlyProvider(connection);
    const program = new anchor.Program<SolanaPrograms>(idl as SolanaPrograms, provider);

    // Fetch Ledger to get chain head
    const ledgerPda = deriveLedgerPda();
    console.log("Sync: Fetching ledger");

    const ledger = await program.account.ledger.fetch(ledgerPda);
    const headHash = new Uint8Array(ledger.lastValidUtxoHash);

    console.log(`Sync: Ledger tip hash: ${Buffer.from(headHash).toString('hex').slice(0, 16)}...`);

    // Check if ledger is empty (genesis state)
    if (isGenesisHash(headHash)) {
        console.log("Sync: Ledger is empty (genesis state)");
        return {
            utxos: [],
            confirmedBalance: 0,
            pendingBalance: 0,
            totalBalance: 0
        };
    }

    const myUtxos: DecryptedUtxo[] = [];
    let currentHash = headHash;
    let index = 0;
    let shouldStop = false;

    // Traverse linked list from head (newest) to tail (oldest)
    while (!isGenesisHash(currentHash) && !shouldStop) {
        const utxoPda = deriveUtxoPda(currentHash);

        try {
            const rawUtxo = await program.account.utxo.fetch(utxoPda);

            // Try to decrypt this UTXO
            try {
                const ciphertext = Uint8Array.from(rawUtxo.kyberCiphertext);
                const nonce = Uint8Array.from(rawUtxo.nonce);
                const payload = Uint8Array.from(rawUtxo.encryptedPayload);

                const decrypted = tryDecryptUtxo(secretKey, ciphertext, nonce, payload, index);

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

                const decryptedUtxo: DecryptedUtxo = {
                    amount: Number(decrypted.amount),
                    isReturn: decrypted.is_return,
                    randomness: Array.from(decrypted.randomness),
                    index,
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
                };

                myUtxos.push(decryptedUtxo);

                // Stop condition: finalized (votes=null) AND is_return=true
                // This means we've found our last confirmed return UTXO
                if (status === 'finalized' && decrypted.is_return) {
                    console.log(`Sync: Found finalized return UTXO at index ${index}, stopping traversal`);
                    shouldStop = true;
                }

            } catch (e) {
                // Decryption failed = Not our UTXO, continue traversal
            }

            // Move to previous UTXO in chain
            currentHash = new Uint8Array(rawUtxo.prevUtxoHash);
            index++;

        } catch (e) {
            // UTXO account not found, this shouldn't happen in a valid chain
            console.error(`Sync: Failed to fetch UTXO at hash ${Buffer.from(currentHash).toString('hex').slice(0, 16)}...`);
            break;
        }
    }

    // Reverse to get chronological order (oldest first)
    myUtxos.reverse();
    // Update indices to reflect chronological order
    myUtxos.forEach((u, i) => u.index = i);

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

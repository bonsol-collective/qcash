import {
  AnchorProvider,
  Program,
  utils,
  web3,
  type Idl,
} from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useWallet } from "../context/WalletContext";
import idl from "../idl/qcash_program.json";
import { useWasm } from "./useWasm";
import type { SolanaPrograms } from "../idl/solana_programs";

const NETWORK = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("QCashfSHwqptwFRSbqjBnxYH7GbDzbAfxVeDGXhL1fv");
const MIN_SOL_REQUIRED = 0.01 * web3.LAMPORTS_PER_SOL;

export class InsufficientFundsError extends Error {
  constructor(address: string, currentBalance: number) {
    super(
      `Insufficient SOL. Address: ${address} has ${currentBalance / 1e9} SOL.`
    );
    this.name = "InsufficientFundsError";
  }
}

const connection = new Connection(NETWORK, "confirmed");

export const useSolana = () => {
  const { wallet } = useWallet();
  const { getSolanaSecret, isReady: wasmReady } = useWasm();

  const getProvider = async (): Promise<AnchorProvider> => {
    if (!wallet?.mnemonic) {
      throw new Error("Wallet not connected");
    }
    if (!wasmReady) {
      throw new Error("WASM not initialized");
    }

    // Get keypair from wallet mnemonic
    const secretBytes = getSolanaSecret(wallet.mnemonic);
    const payer = Keypair.fromSecretKey(secretBytes);

    // Create provider with proper wallet that can sign transactions
    const provider = new AnchorProvider(connection, {
      publicKey: payer.publicKey,
      signTransaction: async <T extends web3.Transaction | web3.VersionedTransaction>(tx: T): Promise<T> => {
        if (tx instanceof web3.Transaction) {
          tx.partialSign(payer);
        }
        return tx;
      },
      signAllTransactions: async <T extends web3.Transaction | web3.VersionedTransaction>(txs: T[]): Promise<T[]> => {
        txs.forEach((tx) => {
          if (tx instanceof web3.Transaction) {
            tx.partialSign(payer);
          }
        });
        return txs;
      },
    }, { preflightCommitment: "confirmed" });

    return provider;
  }

  const getProgram = async (): Promise<Program<SolanaPrograms>> => {
    const provider = await getProvider();
    const program = new Program<SolanaPrograms>(idl as SolanaPrograms, provider);
    return program;
  }

  const getSolBalance = async () => {

    if (!wallet?.solana_address) {
      throw new Error("Solana Address not found");
    }

    const balance = await connection.getBalance(new PublicKey(wallet?.solana_address));
    return balance;
  }

  const deriveVaultPDA = async () => {

    if (!wallet?.kyber_pubkey) {
      throw new Error("Kyber key not found");
    }

    const kyberKeyBytes = utils.bytes.bs58.decode(wallet.kyber_pubkey);

    const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(kyberKeyBytes));
    const hashArray = Array.from(new Uint8Array(hash));

    const [vault_pda, _bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        Buffer.from(hashArray)
      ],
      PROGRAM_ID
    )

    console.log("Vault_pda", vault_pda.toString());

    return vault_pda;
  }

  const getVaultState = async (): Promise<PublicKey | null> => {
    const vault_pda = await deriveVaultPDA();

    console.log("Vault_pda", vault_pda.toString());

    const vault_info = await connection.getAccountInfo(vault_pda);

    console.log("Vault_info", vault_info);

    if (!vault_info) {
      return null;
    }

    return vault_pda;
  }

  const registerVault = async () => {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    if (!wasmReady) {
      throw new Error("WASM not initialized");
    }

    // // FOR TESTING, we are generating random public key
    // const payer = Keypair.generate();
    // console.log("Requesting Airdrop for Payer:", payer.publicKey.toString());
    // const airDropSig = await connection.requestAirdrop(
    //   payer.publicKey,
    //   2 * web3.LAMPORTS_PER_SOL,
    // );
    // await connection.confirmTransaction(airDropSig);

    const secretBytes = getSolanaSecret(wallet.mnemonic);

    // Recontructing the keypair
    const payer = Keypair.fromSecretKey(secretBytes);
    console.log("Payer Public Key:", payer.publicKey.toString());

    if (payer.publicKey.toString() != wallet.solana_address) {
      throw new Error("Derived key does not match Wallet Address! Derivation mismatch.");
    }

    const balance = await connection.getBalance(payer.publicKey);
    if (balance < MIN_SOL_REQUIRED) {
      throw new InsufficientFundsError(payer.publicKey.toString(), balance);
    }

    // setup anchor program
    const program = new Program(
      idl as Idl,
      new AnchorProvider(connection, {
        publicKey: payer.publicKey,
        signTransaction: async <
          T extends web3.Transaction | web3.VersionedTransaction,
        >(
          tx: T,
        ): Promise<T> => {
          if (tx instanceof web3.Transaction) {
            tx.sign(payer);
          }
          return tx;
        },
        signAllTransactions: async <
          T extends web3.Transaction | web3.VersionedTransaction,
        >(
          txs: T[],
        ): Promise<T[]> => {
          txs.forEach((tx) => {
            if (tx instanceof web3.Transaction) {
              tx.sign(payer);
            }
          });
          return txs;
        },
      }),
    );

    if (!wallet.kyber_pubkey) {
      throw new Error("Kyber key not found");
    }

    // convert kyber key to buffer(Vec<u8>)
    const kyberBytes = utils.bytes.bs58.decode(
      wallet.kyber_pubkey,
    );

    const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(kyberBytes));
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    const [vault_pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        Buffer.from(hashArray)
      ],
      PROGRAM_ID,
    )

    // const vault_pda = await deriveVaultPDA();

    // splitting data - use Buffer for Anchor bytes encoding
    const part1 = Buffer.from(kyberBytes.slice(0, 700));
    const part2 = Buffer.from(kyberBytes.slice(700));

    const tx1 = await program.methods
      .initVault(hashArray, part1)
      .accounts({
        vault: vault_pda,
        signer: payer.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    console.log("Part 1 Confirmed:", tx1);
    await connection.confirmTransaction(tx1);

    console.log("Sending Part 2 (Complete)...");
    const tx2 = await program.methods
      .completeVault(part2)
      .accounts({
        vault: vault_pda,
        signer: payer.publicKey,
      })
      .signers([payer])
      .rpc();

    console.log("Vault Registered Successfully!", tx2);
    return tx2;

  };

  return { connection, registerVault, getVaultState, getSolBalance, getProgram };
};

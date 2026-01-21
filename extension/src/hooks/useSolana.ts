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

const NETWORK = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey("AFdP6ozXCdssyUwFiiny7CixRRBL5KkJtxw8U3EFCWYD");
const MIN_SOL_REQUIRED = 0.01 * web3.LAMPORTS_PER_SOL;
const KYBER_KEY_LENGTH = 1184;

export class InsufficientFundsError extends Error {
  constructor( address: string, currentBalance: number) {
    super(
      `Insufficient SOL. Address: ${address} has ${currentBalance / 1e9} SOL.`
    );
    this.name = "InsufficientFundsError";
  }
}

export const useSolana = () => {
  const wallet = useWallet();
  const { getSolanaSecret, isReady: wasmReady } = useWasm();
  const connection = new Connection(NETWORK,"confirmed");

  // const getProvider = ()=>{
  //     const connection = new Connection(NETWORK, "confirmed");
  //     // We only need to sign transaction
  //     // In reality we should use the user sol key.
  //     // For testing we are importing a dummy key.
  //     const provider = new AnchorProvider(connection,(window as any).solana,{
  //         preflightCommitment: "confirmed",
  //     })
  //     return provider;
  // }

  const getSolBalance = async()=>{

    if(!wallet?.wallet?.solana_address){
      throw new Error("Solana Address not found");
    }

    const balance = await connection.getBalance(new PublicKey(wallet?.wallet?.solana_address));
    return balance;
  }

  const deriveVaultPDA = async()=>{

    if(!wallet?.wallet?.kyber_pubkey){
      throw new Error("Kyber key not found");
    }

    const hash = await crypto.subtle.digest("SHA-256",Buffer.from(wallet.wallet.kyber_pubkey));
    const hashArray = new Uint8Array(hash);

    const [vault_pda,_bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        hashArray
      ],
      PROGRAM_ID
    )

    return vault_pda;
  }

  const getVaultState = async():Promise<PublicKey|null>=>{
    const vault_pda = await deriveVaultPDA();

    const vault_info = await connection.getAccountInfo(vault_pda);

    if (vault_info?.data.length != KYBER_KEY_LENGTH){
      return null;
    }

    return vault_pda;
  }

  const registerVault = async () => {
    if (!wallet || !wallet.wallet) {
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

    const secretBytes = getSolanaSecret(wallet.wallet?.mnemonic);

    // Recontructing the keypair
    const payer = Keypair.fromSecretKey(secretBytes);
    console.log("Payer Public Key:", payer.publicKey.toString());

    if(payer.publicKey.toString() != wallet.wallet.solana_address){
      throw new Error("Derived key does not match Wallet Address! Derivation mismatch.");
    }

    const balance = await connection.getBalance(payer.publicKey);
    if(balance < MIN_SOL_REQUIRED){
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

    if(!wallet.wallet?.kyber_pubkey){
      throw new Error("Kyber key not found");
    }

    // convert kyber key to buffer(Vec<u8>)
    const kyberBytes = utils.bytes.bs58.decode(
      wallet.wallet?.kyber_pubkey,
    );

    const hashBuffer = await crypto.subtle.digest("SHA-256",kyberBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // const [vault_pda] = PublicKey.findProgramAddressSync(
    //   [
    //     Buffer.from("vault"),
    //     Buffer.from(hashArray)
    //   ],
    //   PROGRAM_ID,
    // )

    const vault_pda = await deriveVaultPDA();

    // splitting data - use Buffer for Anchor bytes encoding
    const part1 = Buffer.from(kyberBytes.slice(0,700));
    const part2 = Buffer.from(kyberBytes.slice(700));

    const tx1 = await program.methods
    .initVault(hashArray, part1)
    .accounts({
      vault:vault_pda,
      signer:payer.publicKey,
      systemProgram:web3.SystemProgram.programId,
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

  return { registerVault,getVaultState,getSolBalance };
};

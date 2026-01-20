import {
  AnchorProvider,
  Program,
  utils,
  web3,
  type Idl,
} from "@coral-xyz/anchor";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useWallet } from "../context/WalletContext";
import idl from "../idl/qcash_program.json";

const NETWORK = "http://127.0.0.1:8899";
const PROGRAM_ID = "AFdP6ozXCdssyUwFiiny7CixRRBL5KkJtxw8U3EFCWYD";

export const useSolana = () => {
  const wallet = useWallet();

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

  const registerVault = async () => {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    const connection = new Connection(NETWORK, "confirmed");

    // FOR TESTING, we are generating random public key
    const payer = Keypair.generate();
    console.log("Requesting Airdrop for Payer:", payer.publicKey.toString());
    const airDropSig = await connection.requestAirdrop(
      payer.publicKey,
      2 * web3.LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(airDropSig);

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

    // convert kyber key to buffer(Vec<u8>)
    const kyberBytes = utils.bytes.bs58.decode(
      wallet.wallet?.kyber_pubkey || "",
    );
    console.log(
      "Registering Vault for Kyber Key...",
      kyberBytes.length,
      "bytes",
    );

    // Use Keccak256 to match the Rust program (solana_program::keccak)
    const hashArray = keccak_256(kyberBytes);
    console.log(
      "Hash length:",
      hashArray.length,
      "Hash:",
      Array.from(hashArray),
    );

    const [vault_pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), hashArray],
      new PublicKey(PROGRAM_ID),
    );

    console.log("Vault PDA:", vault_pda.toString());

    const tx = await program.methods
      .registerVault(kyberBytes, Array.from(hashArray))
      .accounts({
        signer: payer.publicKey,
      })
      .signers([payer])
      .rpc();

    console.log("Vault Registered! Signature:", tx);
    return tx;
  };

  return { registerVault };
};

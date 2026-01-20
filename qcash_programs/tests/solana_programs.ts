import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { keccak_256 } from "js-sha3";
import { SolanaPrograms } from "../target/types/solana_programs";

describe("qcash_programs", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.solanaPrograms as Program<SolanaPrograms>;

  it("Registers a vault with a test kyber key (raw instruction)", async () => {
    // Generate a random 1184 byte "kyber key" for testing
    const kyberPubkey = Buffer.alloc(1184);
    for (let i = 0; i < 1184; i++) {
      kyberPubkey[i] = Math.floor(Math.random() * 256);
    }

    console.log("Kyber pubkey length:", kyberPubkey.length);

    // Hash it with keccak256
    const hashArray = new Uint8Array(keccak_256.array(kyberPubkey));
    console.log("Hash length:", hashArray.length);

    // Derive PDA
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), hashArray],
      program.programId
    );

    console.log("Vault PDA:", vaultPda.toString());

    // Build instruction data manually
    // Format: [8-byte discriminator][4-byte length prefix for Vec<u8>][1184 bytes data][32 bytes hash]
    const discriminator = Buffer.from([121, 62, 4, 122, 93, 231, 119, 49]); // from IDL

    // Vec<u8> encoding: 4-byte LE length prefix + data
    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32LE(kyberPubkey.length, 0);

    const instructionData = Buffer.concat([
      discriminator,
      lengthPrefix,
      kyberPubkey,
      Buffer.from(hashArray)
    ]);

    console.log("Instruction data length:", instructionData.length);

    // Create raw instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: program.programId,
      data: instructionData,
    });

    // Send transaction
    const tx = new Transaction().add(instruction);
    const signature = await provider.sendAndConfirm(tx);

    console.log("Transaction signature:", signature);
  });
});

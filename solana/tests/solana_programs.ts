import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { sha256 } from "js-sha256";
import { expect } from "chai";
import { SolanaPrograms } from "../target/types/solana_programs";

describe("qcash_programs", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.solanaPrograms as Program<SolanaPrograms>;

  // Test accounts
  const admin = provider.wallet;
  let prover1: Keypair;
  let prover2: Keypair;

  // PDAs
  let programConfigPda: PublicKey;
  let proverRegistryPda: PublicKey;
  let ledgerPda: PublicKey;
  let vaultPda: PublicKey;
  let loaderKeypair: Keypair;
  let zkProofKeypair: Keypair;

  // Test data
  let kyberPubkey: Buffer;
  let kyberKeyHash: Buffer;
  let kyberCiphertext: Buffer;
  let utxoHash: Buffer;
  let utxoHash2: Buffer;

  before("Setup test accounts and data", () => {
    prover1 = Keypair.generate();
    prover2 = Keypair.generate();
    loaderKeypair = Keypair.generate();
    zkProofKeypair = Keypair.generate();

    kyberPubkey = Buffer.alloc(1184);
    for (let i = 0; i < 1184; i++) {
      kyberPubkey[i] = Math.floor(Math.random() * 256);
    }
    kyberKeyHash = Buffer.from(sha256.array(kyberPubkey));

    kyberCiphertext = Buffer.alloc(1088);
    for (let i = 0; i < 1088; i++) {
      kyberCiphertext[i] = Math.floor(Math.random() * 256);
    }

    console.log("Admin:", admin.publicKey.toString());
    console.log("Prover 1:", prover1.publicKey.toString());
    console.log("Prover 2:", prover2.publicKey.toString());
  });

  it("Initializes the program with admin authority", async () => {
    [programConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("program_config")],
      program.programId,
    );

    [proverRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("prover_registry")],
      program.programId,
    );

    console.log("Program Config PDA:", programConfigPda.toString());
    console.log("Prover Registry PDA:", proverRegistryPda.toString());

    const tx = await program.methods
      .initProgram()
      .accounts({
        admin: admin.publicKey,
      })
      .rpc();

    console.log("Init program transaction:", tx);

    const configAccount = await program.account.programConfig.fetch(
      programConfigPda,
    );
    expect(configAccount.adminAuthority.toString()).to.equal(
      admin.publicKey.toString(),
    );
    expect(configAccount.minAttestations).to.equal(1);
    console.log(
      "Program initialized with admin:",
      configAccount.adminAuthority.toString(),
    );
  });

  it("Registers prover 1", async () => {
    const airdropSig = await provider.connection.requestAirdrop(
      prover1.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(airdropSig);

    const uniqueId = 1;

    const tx = await program.methods
      .registerProver(new anchor.BN(uniqueId))
      .accounts({
        admin: admin.publicKey,
        proverPubkey: prover1.publicKey,
      })
      .rpc();

    console.log("Register prover 1 transaction:", tx);

    const registryAccount = await program.account.proverRegistry.fetch(
      proverRegistryPda,
    );
    expect(registryAccount.proverCount).to.equal(1);
    console.log("Prover 1 registered with unique ID:", uniqueId);
  });

  it("Registers prover 2", async () => {
    const airdropSig = await provider.connection.requestAirdrop(
      prover2.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(airdropSig);

    const uniqueId = 2;

    const tx = await program.methods
      .registerProver(new anchor.BN(uniqueId))
      .accounts({
        admin: admin.publicKey,
        proverPubkey: prover2.publicKey,
      })
      .rpc();

    console.log("Register prover 2 transaction:", tx);

    const registryAccount = await program.account.proverRegistry.fetch(
      proverRegistryPda,
    );
    expect(registryAccount.proverCount).to.equal(2);
    console.log("Prover 2 registered with unique ID:", uniqueId);
  });

  it("Initializes the ledger", async () => {
    [ledgerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ledger")],
      program.programId,
    );

    console.log("Ledger PDA:", ledgerPda.toString());

    const tx = await program.methods
      .initLedger()
      .accounts({
        payer: admin.publicKey,
      })
      .rpc();

    console.log("Init ledger transaction:", tx);

    const ledgerAccount = await program.account.ledger.fetch(ledgerPda);
    expect(ledgerAccount.count.toString()).to.equal("0");

    const genesisHash = Buffer.alloc(32, 0);
    expect(Buffer.from(ledgerAccount.lastValidUtxoHash)).to.deep.equal(
      genesisHash,
    );
    console.log("Ledger initialized with genesis hash");
  });

  it("Initializes a vault (part 1 of 2)", async () => {
    const kyberKeyPart1 = kyberPubkey.slice(0, 800);

    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), kyberKeyHash],
      program.programId,
    );

    console.log("Vault PDA:", vaultPda.toString());

    const tx = await program.methods
      .initVault(Array.from(kyberKeyHash), Buffer.from(kyberKeyPart1))
      .accounts({
        signer: admin.publicKey,
      })
      .rpc();

    console.log("Init vault transaction:", tx);
    console.log("Vault initialized with part 1 of Kyber key");
  });

  it("Completes vault initialization (part 2 of 2)", async () => {
    const kyberKeyPart2 = kyberPubkey.slice(800);

    const tx = await program.methods
      .completeVault(Buffer.from(kyberKeyPart2))
      .accounts({
        vault: vaultPda,
      })
      .rpc();

    console.log("Complete vault transaction:", tx);

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    expect(vaultAccount.kyberPubkey.length).to.equal(1184);
    console.log("Vault completed with full Kyber public key");
  });

  it("Initializes loader for Kyber ciphertext", async () => {
    const tx = await program.methods
      .initLoader()
      .accounts({
        signer: admin.publicKey,
        loader: loaderKeypair.publicKey,
      })
      .signers([loaderKeypair])
      .rpc();

    console.log("Init loader transaction:", tx);
    console.log("Loader initialized");
  });

  it("Writes Kyber ciphertext to loader in chunks", async () => {
    const CHUNK_SIZE = 800;
    let offset = 0;

    while (offset < kyberCiphertext.length) {
      const chunk = kyberCiphertext.slice(offset, offset + CHUNK_SIZE);

      const tx = await program.methods
        .writeLoader(offset, Buffer.from(chunk))
        .accounts({
          loader: loaderKeypair.publicKey,
        })
        .rpc();

      console.log(`Write loader chunk at offset ${offset}, tx:`, tx);
      offset += chunk.length;
    }

    console.log("Kyber ciphertext written to loader");
  });

  it("Initializes ZK proof account", async () => {
    const proofSize = 500;

    const tx = await program.methods
      .initZkProof(proofSize)
      .accounts({
        signer: admin.publicKey,
        zkProof: zkProofKeypair.publicKey,
      })
      .signers([zkProofKeypair])
      .rpc();

    console.log("Init ZK proof transaction:", tx);
    console.log("ZK proof account initialized");
  });

  it("Writes ZK proof data in chunks", async () => {
    const proofData = Buffer.alloc(500);
    for (let i = 0; i < proofData.length; i++) {
      proofData[i] = Math.floor(Math.random() * 256);
    }

    const CHUNK_SIZE = 200;
    let offset = 0;

    while (offset < proofData.length) {
      const chunk = proofData.slice(offset, offset + CHUNK_SIZE);

      const tx = await program.methods
        .writeZkProof(offset, Buffer.from(chunk))
        .accounts({
          zkProof: zkProofKeypair.publicKey,
        })
        .rpc();

      console.log(`Write ZK proof chunk at offset ${offset}, tx:`, tx);
      offset += chunk.length;
    }

    console.log("ZK proof data written");
  });

  it("Creates a UTXO", async () => {
    const epoch = 0;
    const nonce = Buffer.alloc(12);
    for (let i = 0; i < 12; i++) {
      nonce[i] = Math.floor(Math.random() * 256);
    }

    const encryptedPayload = Buffer.alloc(256);
    for (let i = 0; i < encryptedPayload.length; i++) {
      encryptedPayload[i] = Math.floor(Math.random() * 256);
    }

    const ledgerAccount = await program.account.ledger.fetch(ledgerPda);
    const prevUtxoHash = Buffer.from(ledgerAccount.lastValidUtxoHash);

    const commitmentData = Buffer.concat([
      kyberCiphertext,
      nonce,
      encryptedPayload,
    ]);
    const ciphertextCommitment = Buffer.from(sha256.array(commitmentData));

    // Compute UTXO hash: SHA256(prev_utxo_hash || ciphertext_commitment || epoch)
    const epochBytes = Buffer.alloc(4);
    epochBytes.writeUInt32LE(epoch, 0);
    const headerData = Buffer.concat([
      prevUtxoHash,
      ciphertextCommitment,
      epochBytes,
    ]);
    utxoHash = Buffer.from(sha256.array(headerData));

    console.log("UTXO hash:", utxoHash.toString("hex"));
    console.log("Prev UTXO hash:", prevUtxoHash.toString("hex"));

    const [utxoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("utxo"), utxoHash],
      program.programId,
    );

    console.log("UTXO PDA:", utxoPda.toString());

    const tx = await program.methods
      .createUtxo(
        Array.from(utxoHash),
        Buffer.from(encryptedPayload),
        Array.from(nonce),
        epoch,
      )
      .accounts({
        signer: admin.publicKey,
        loader: loaderKeypair.publicKey,
        zkProof: zkProofKeypair.publicKey,
      })
      .rpc();

    console.log("Create UTXO transaction:", tx);

    // Fetch and verify UTXO
    const utxoAccount = await program.account.utxo.fetch(utxoPda);
    expect(Buffer.from(utxoAccount.utxoHash)).to.deep.equal(utxoHash);
    expect(Buffer.from(utxoAccount.prevUtxoHash)).to.deep.equal(prevUtxoHash);
    expect(utxoAccount.epoch).to.equal(epoch);
    console.log("UTXO created successfully");
  });

  it("Prover 1 submits attestation for UTXO", async () => {
    // Derive UTXO PDA
    const [utxoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("utxo"), utxoHash],
      program.programId,
    );

    // Generate next key hash for key rotation
    // This should be the hash of the NEW prover pubkey that will be used next time
    const nextKeyHash = Buffer.from(sha256.array(prover1.publicKey.toBuffer()));

    const vote = true; // Valid vote

    const tx = await program.methods
      .submitAttestation(Array.from(utxoHash), vote, Array.from(nextKeyHash))
      .accounts({
        proverOld: prover1.publicKey, // Current prover (signs and pays)
        prover: prover1.publicKey, // New prover (same for first attestation)
        // ledger: ledgerPda,
        // utxo: utxoPda,
        // proverRegistry: proverRegistryPda,
        // systemProgram: SystemProgram.programId,
      })
      .signers([prover1]) // Only need to sign with prover1 since both are same
      .rpc();

    console.log("Submit attestation transaction:", tx);

    // Fetch and verify UTXO votes
    const utxoAccount = await program.account.utxo.fetch(utxoPda);
    const validVotes = utxoAccount.votes.filter(
      (v: any) => v.proverId.toString() !== "0" && v.isValid,
    ).length;
    expect(validVotes).to.equal(1);

    // Verify ledger was updated (since MIN_ATTESTATIONS_REQUIRED = 1)
    const ledgerAccount = await program.account.ledger.fetch(ledgerPda);
    expect(Buffer.from(ledgerAccount.lastValidUtxoHash)).to.deep.equal(
      utxoHash,
    );
    expect(ledgerAccount.count.toString()).to.equal("1");
    console.log("✓ Attestation submitted and ledger updated");
  });

  it("Creates a second UTXO (chained)", async () => {
    const loader2Keypair = Keypair.generate();

    await program.methods
      .initLoader()
      .accounts({
        signer: admin.publicKey,
        loader: loader2Keypair.publicKey,
      })
      .signers([loader2Keypair])
      .rpc();

    const newCiphertext = Buffer.alloc(1088);
    for (let i = 0; i < 1088; i++) {
      newCiphertext[i] = Math.floor(Math.random() * 256);
    }

    let offset = 0;
    const CHUNK_SIZE = 800;
    while (offset < newCiphertext.length) {
      const chunk = newCiphertext.slice(offset, offset + CHUNK_SIZE);
      await program.methods
        .writeLoader(offset, Buffer.from(chunk))
        .accounts({ loader: loader2Keypair.publicKey })
        .rpc();
      offset += chunk.length;
    }

    const zkProof2Keypair = Keypair.generate();
    await program.methods
      .initZkProof(500)
      .accounts({
        signer: admin.publicKey,
        zkProof: zkProof2Keypair.publicKey,
      })
      .signers([zkProof2Keypair])
      .rpc();

    const epoch = 0;
    const nonce = Buffer.alloc(12);
    for (let i = 0; i < 12; i++) {
      nonce[i] = Math.floor(Math.random() * 256);
    }

    const encryptedPayload = Buffer.alloc(256);
    for (let i = 0; i < encryptedPayload.length; i++) {
      encryptedPayload[i] = Math.floor(Math.random() * 256);
    }

    const ledgerAccount = await program.account.ledger.fetch(ledgerPda);
    const prevUtxoHash = Buffer.from(ledgerAccount.lastValidUtxoHash);

    const commitmentData = Buffer.concat([
      newCiphertext,
      nonce,
      encryptedPayload,
    ]);
    const ciphertextCommitment = Buffer.from(sha256.array(commitmentData));

    const epochBytes = Buffer.alloc(4);
    epochBytes.writeUInt32LE(epoch, 0);
    const headerData = Buffer.concat([
      prevUtxoHash,
      ciphertextCommitment,
      epochBytes,
    ]);
    utxoHash2 = Buffer.from(sha256.array(headerData));

    const [utxo2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("utxo"), utxoHash2],
      program.programId,
    );

    const tx = await program.methods
      .createUtxo(
        Array.from(utxoHash2),
        Buffer.from(encryptedPayload),
        Array.from(nonce),
        epoch,
      )
      .accounts({
        signer: admin.publicKey,
        loader: loader2Keypair.publicKey,
        zkProof: zkProof2Keypair.publicKey,
      })
      .rpc();

    console.log("Create second UTXO transaction:", tx);

    const utxo2Account = await program.account.utxo.fetch(utxo2Pda);
    expect(Buffer.from(utxo2Account.prevUtxoHash)).to.deep.equal(utxoHash);
    console.log("Second UTXO created and chained to first UTXO");
  });

  it("Deactivates prover 2", async () => {
    const tx = await program.methods
      .deactivateProver()
      .accounts({
        admin: admin.publicKey,
        proverPubkey: prover2.publicKey,
      })
      .rpc();

    console.log("Deactivate prover transaction:", tx);

    const registryAccount = await program.account.proverRegistry.fetch(
      proverRegistryPda,
    );
    const prover2Hash = Buffer.from(sha256.array(prover2.publicKey.toBuffer()));
    const prover2Info = registryAccount.provers.find((p: any) =>
      Buffer.from(p.pubkeyHash).equals(prover2Hash),
    );
    expect(prover2Info.isActive).to.equal(false);
    console.log("Prover 2 deactivated");
  });

  it("Fails when deactivated prover tries to vote", async () => {
    const nextKeyHash = Buffer.alloc(32);

    try {
      await program.methods
        .submitAttestation(Array.from(utxoHash2), true, Array.from(nextKeyHash))
        .accounts({
          proverOld: prover2.publicKey,
          prover: prover2.publicKey,
        })
        .signers([prover2])
        .rpc();

      // Should not reach here
      expect.fail("Should have thrown error for deactivated prover");
    } catch (error) {
      expect(error.toString()).to.include("ProverNotActive");
      console.log("Deactivated prover correctly rejected");
    }
  });
});

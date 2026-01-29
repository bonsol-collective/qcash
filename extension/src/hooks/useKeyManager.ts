import { useState, useEffect } from 'react';
import { utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useWallet } from "../context/WalletContext";

const PROGRAM_ID = new PublicKey("DMiW8pL1vuaRSG367zDRRkSmQM8z5kKUGU3eC9t7AFDT");

export interface CryptoKeys {
  seed: number[];           // Converted from entropy hex
  kyberPublicKey: number[]; // Converted from Base58
  kyberSecretKey: number[]; // Passed through
  vaultPda: string;         // Derived from Kyber Pubkey
}

export function useKeyManager() {
  const { wallet: storedWallet, isLoading: isContextLoading } = useWallet();
  const [keys, setKeys] = useState<CryptoKeys | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);

  useEffect(() => {
    const deriveKeys = async () => {
      if (!storedWallet) {
        setKeys(null);
        return;
      }

      setIsDeriving(true);
      try {
        console.log("Converting stored strings to crypto bytes...");

        // Convert Hex String -> Byte Array (Seed)
        // logic: "ab" -> 171
        const seedBytes = new Uint8Array(
          storedWallet.secret_entropy_hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
        );

        // Convert Base58 String -> Byte Array (Kyber Pub)
        const kyberPubBytes = utils.bytes.bs58.decode(storedWallet.kyber_pubkey);

        // Derive Vault PDA (Critical for Return Address)
        const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(kyberPubBytes));
        const hashArray = new Uint8Array(hashBuffer);

        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), Buffer.from(hashArray)],
          PROGRAM_ID
        );

        // Create the Crypto Object
        const operationalKeys: CryptoKeys = {
          seed: Array.from(seedBytes),
          kyberPublicKey: Array.from(kyberPubBytes),
          kyberSecretKey: storedWallet.kyber_secret_key,
          vaultPda: vaultPda.toString()
        };

        setKeys(operationalKeys);
        console.log("Keys Converted & Ready");

      } catch (e) {
        console.error("Key Derivation Failed:", e);
      } finally {
        setIsDeriving(false);
      }
    };

    deriveKeys();
  }, [storedWallet]);

  return {
    keys,
    isLoading: isContextLoading || isDeriving
  };
}
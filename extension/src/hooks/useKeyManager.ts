import { useState, useEffect } from 'react';

export interface WalletData {
  seed: number[]; // 32 bytes
  kyberPublicKey: number[]; // 1184 bytes
  kyberSecretKey: number[]; // 2400 bytes
  vaultPda: string;  // needed for return destination
}

export function useKeyManager() {
  const [keys, setKeys] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only run in extension environment
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["qcash_wallet"], (result) => {
        if (result.qcash_wallet) {
          console.log("Wallet loaded from storage");
          setKeys(result.qcash_wallet as WalletData);
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  return { keys, isLoading };
}

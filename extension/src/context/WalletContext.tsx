import React, { useContext, useEffect, useState, type ReactNode } from "react";

export interface StoredWallet{
    mnemonic: string;
    solana_address: string;
    kyber_pubkey: string; // base58
    kyber_secret_key: number[];  // For background sync
    secret_entropy_hex: string;
}

interface WalletContextType{
    wallet:StoredWallet | null;
    isLoading:boolean;
    setWallet: (wallet: StoredWallet | null)=>void;
    clearWallet: ()=>void;
}

const WalletContext = React.createContext<WalletContextType|null>(null);

export const WalletProvider = ({children}:{children:ReactNode})=>{
    const [wallet,setWalletState] = useState<StoredWallet|null>(null);
    const [isLoading,setIsLoading] = useState(true);

    // load from Chrome Storage on App Start
    useEffect(()=>{
        // check if you are in chrome environment
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local){
            chrome.storage.local.get(["qcash_wallet"],(result)=>{
                if(result.qcash_wallet){
                    console.log("Wallet loaded from storage");
                    const loadedWallet = result.qcash_wallet as StoredWallet;
                    setWalletState(loadedWallet);

                    // Ensure kyber_secret_key is stored for background sync
                    if (loadedWallet.kyber_secret_key) {
                        chrome.storage.local.set({ kyber_secret_key: loadedWallet.kyber_secret_key });
                    }
                }
                setIsLoading(false);
            })
        }else{
            // Fallback for non-extension
            const local = localStorage.getItem("qcash_wallet");
            if(local){
                setWalletState(JSON.parse(local));
            }
            setIsLoading(false);
        }
    },[])

    const setWallet = (newWallet:StoredWallet | null)=>{
        setWalletState(newWallet);
        if(newWallet){
            // save
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({
                    qcash_wallet: newWallet,
                    kyber_secret_key: newWallet.kyber_secret_key  // For background sync
                });
            } else {
                localStorage.setItem("qcash_wallet", JSON.stringify(newWallet));
            }
        }else{
            // Clear
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.remove("qcash_wallet");
            } else {
                localStorage.removeItem("qcash_wallet");
            }
        }
    }

    const clearWallet = ()=> setWallet(null);

    return (
        <WalletContext.Provider value={{wallet,setWallet,clearWallet,isLoading}}>
            {children}
        </WalletContext.Provider>
    )
}

export const useWallet = ()=>{
    const context = useContext(WalletContext);
    if (!context){
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}

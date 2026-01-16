import React, { useContext, useState, type ReactNode } from "react";

export interface WalletData{
    mnemonic: string;
    solana_address: string;
    kyber_pubkey: string;
    secret_entropy_hex: string;
}

interface WalletContextType{
    wallet:WalletData | null;
    setWallet: (wallet: WalletData | null)=>void;
}

const WalletContext = React.createContext<WalletContextType|null>(null);

export const WalletProvider = ({children}:{children:ReactNode})=>{
    const [wallet,setWallet] = useState<WalletData|null>(null);

    return (
        <WalletContext.Provider value={{wallet,setWallet}}>
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

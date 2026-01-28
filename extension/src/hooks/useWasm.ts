import { useEffect, useState } from "react";
import init, { generate_wallet, get_solana_secret, init_panic_hook, restore_wallet } from '../wasm/qcash_wasm';

export const useWasm = ()=>{
    const [isReady,setIsReady] = useState(false);

    useEffect(()=>{
        // Initialize WASM module
        init().then(()=>{
            init_panic_hook();
            setIsReady(true);
            console.log("WASM Initialized");
        })
    },[])

    const createIdentity = async()=>{
        if (!isReady){
            throw new Error("WASM not initialized");
        }

        const result = await generate_wallet();
        console.log("WASM generate_wallet result:", result);
        console.log("kyber_secret_key exists:", !!result.kyber_secret_key);
        console.log("kyber_secret_key type:", typeof result.kyber_secret_key);
        if (result.kyber_secret_key) {
            console.log("kyber_secret_key length:", result.kyber_secret_key.length);
        }
        return result;
    }

    const restoreIdentity = async(mnemonic:string)=>{
        if (!isReady){
            throw new Error("WASM not initialized");
        }

        const result = await restore_wallet(mnemonic);
        console.log(result);
        return result;
    }

    const getSolanaSecret = (mnemonic: string): Uint8Array => {
        if (!isReady){
            throw new Error("WASM not initialized");
        }

        return get_solana_secret(mnemonic);
    }

    return { isReady, createIdentity, restoreIdentity, getSolanaSecret };
}

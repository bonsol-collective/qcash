import { useEffect, useState } from "react";
import init, { generate_wallet, init_panic_hook, restore_wallet } from '../wasm/qcash_wasm';

export const useWasm = ()=>{
    const [isReady,setIsReady] = useState(false);

    useEffect(()=>{
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
        console.log(result);
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

    return { isReady, createIdentity, restoreIdentity };
}

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import init, { generate_wallet, get_solana_secret, init_panic_hook, restore_wallet } from '../wasm/qcash_wasm';

interface WasmContextType {
    isReady: boolean;
    createIdentity: () => Promise<any>;
    restoreIdentity: (mnemonic: string) => Promise<any>;
    getSolanaSecret: (mnemonic: string) => Uint8Array;
}

const WasmContext = createContext<WasmContextType | null>(null);

export const WasmProvider = ({ children }: { children: ReactNode }) => {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Initialize WASM module once at app startup
        init().then(() => {
            init_panic_hook();
            setIsReady(true);
            console.log("WASM Initialized at startup");
        }).catch((err) => {
            console.error("WASM initialization failed:", err);
        });
    }, []);

    const createIdentity = async () => {
        const result = await generate_wallet();
        console.log("WASM generate_wallet result:", result);
        return result;
    };

    const restoreIdentity = async (mnemonic: string) => {
        const result = await restore_wallet(mnemonic);
        console.log("WASM restore_wallet result:", result);
        return result;
    };

    const getSolanaSecret = (mnemonic: string): Uint8Array => {
        return get_solana_secret(mnemonic);
    };

    // Block rendering until WASM is ready
    if (!isReady) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                color: '#888'
            }}>
                Loading...
            </div>
        );
    }

    return (
        <WasmContext.Provider value={{ isReady, createIdentity, restoreIdentity, getSolanaSecret }}>
            {children}
        </WasmContext.Provider>
    );
};

export const useWasm = () => {
    const context = useContext(WasmContext);
    if (!context) {
        throw new Error("useWasm must be used within a WasmProvider");
    }
    return context;
};

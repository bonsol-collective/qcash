import { useEffect, useState } from "react"

export type DecryptedUtxo = {
    amount:number,
    isReturn:boolean,
    randomness:number[],
    index:number,
}

export const useLedgerSync = ()=>{
    const [balance,setBalance] = useState(0);
    const [utxos,setUtxos] = useState<DecryptedUtxo[]>([]);
    const [lastSync,setLastSync] = useState<number>(0);
    const [isSyncing,setIsSyncing] = useState(false);

    const updateState = (storedUtxos:DecryptedUtxo[] = [],time:number = 0)=>{
        const total = storedUtxos.reduce((acc,u)=>acc + u.amount,0);

        const sorted = [...storedUtxos].sort((a,b)=> b.index - a.index);

        setBalance(total);
        setUtxos(sorted);
        setLastSync(time);
    }

    // load initial data & listener
    useEffect(()=>{

        chrome.storage.local.get(['synced_utxos', 'last_sync_time'], (result) => {
            updateState(result.synced_utxos as DecryptedUtxo[], result.last_sync_time as number);
        });

        const listener = (changes:{ [key: string]: chrome.storage.StorageChange })=>{
            if (changes.synced_utxos){
                console.log("UI received update from Background!");
                // Todo: Pass Date correctly
                updateState(changes.synced_utxos.newValue as DecryptedUtxo[],Date.now());
                setIsSyncing(false);
            }
        }

        chrome.storage.onChanged.addListener(listener);

        return ()=> chrome.storage.onChanged.removeListener(listener);

    },[]);

    // manual trigger 
    const syncNow = ()=>{
        setIsSyncing(true);
        // send message to background script to wake up
        chrome.runtime.sendMessage({type:"START_SYNC"},(response)=>{
            console.log("Sync triggered:", response);
            setTimeout(() => setIsSyncing(false), 5000);
        })
    }

    return { balance, utxos, lastSync, isSyncing, syncNow };
}
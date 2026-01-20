import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useWallet } from '../context/WalletContext';
import { useSolana } from '../hooks/useSolana';

export default function Dashboard() {
  const { wallet } = useWallet();
  const { registerVault } = useSolana();

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [txSig, setTxSig] = useState("");

  const handleRegister = async () => {
    try {
      setStatus('loading');
      const sig = await registerVault();
      setTxSig(sig);
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  if (!wallet) return <div>No Wallet Loaded</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
        Dashboard
      </h1>

      <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-200">System Status</h2>

        {status === 'idle' && (
             <div className="p-4 bg-slate-800/50 rounded border border-slate-700 flex items-center justify-between">
                <span className="text-sm text-slate-400">Vault not registered</span>
                <Button size="sm" onClick={handleRegister} className="bg-cyan-600 hover:bg-cyan-500">
                    Register On-Chain
                </Button>
             </div>
        )}

        {status === 'loading' && (
            <div className="flex items-center justify-center py-4 text-cyan-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Processing on Localnet...
            </div>
        )}

        {status === 'success' && (
            <div className="p-4 bg-emerald-900/20 border border-emerald-800 rounded">
                <div className="flex items-center text-emerald-400 mb-2">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <span className="font-bold">Vault Registered!</span>
                </div>
                <p className="text-xs text-slate-400 break-all">
                    Tx: {txSig}
                </p>
            </div>
        )}

        {status === 'error' && (
            <div className="p-4 bg-red-900/20 border border-red-800 rounded flex items-center text-red-400">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <span>Registration Failed. Check Console.</span>
            </div>
        )}

      </Card>
    </div>
  );
}

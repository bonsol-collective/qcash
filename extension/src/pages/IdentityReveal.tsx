import { ArrowRight, Copy, Shield, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useWallet } from '../context/WalletContext';

export default function IdentityReveal() {
  const navigate = useNavigate();
  const { wallet } = useWallet();

  // Redirect if no wallet exists (user tried to skip)
  if (!wallet) {
    navigate('/');
    return null;
  }

  // Helper to truncate long keys
  const truncate = (str: string, len = 8) =>
    `${str.slice(0, len)}...${str.slice(-len)}`;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
        Your Dual Identity
      </h1>
      <p className="text-slate-400 text-center mb-8 text-sm">
        One seed. Two worlds.
      </p>

      {/* Card 1: Public Solana */}
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-4 mb-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
        <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-purple-100">Public Solana Address</span>
        </div>
        <div className="bg-slate-950 p-3 rounded font-mono text-sm text-slate-300 flex justify-between items-center">
            {truncate(wallet.solana_address)}
            <Copy className="w-4 h-4 cursor-pointer hover:text-white" />
        </div>
      </Card>

      {/* Card 2: Private Vault */}
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 p-4 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
        <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-cyan-100">Private Vault Key</span>
        </div>
        <div className="bg-slate-950 p-3 rounded font-mono text-sm text-slate-300 flex justify-between items-center break-all">
            {/* Kyber keys are huge, maybe show a smaller slice */}
            {truncate(wallet.kyber_pubkey, 12)}
            <Copy className="w-4 h-4 cursor-pointer hover:text-white" />
        </div>
        <p className="text-xs text-slate-500 mt-2">
            This key allows you to receive assets privately using Zero-Knowledge proofs.
        </p>
      </Card>

      <Button
        onClick={() => navigate('/dashboard')}
        className="w-full max-w-md bg-slate-800 hover:bg-slate-700 text-slate-200"
      >
        Enter Dashboard <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );
}

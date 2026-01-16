import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Shield, Wallet } from 'lucide-react';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 animate-fade-in relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/20 blur-[100px] rounded-full"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[100px] rounded-full"></div>
      </div>

      <div className="space-y-2">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.3)] mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400">
          QCash
        </h1>
        <p className="text-slate-400 max-w-[280px] mx-auto">
          Quantum-Safe Privacy Wallet for the Solana Network
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button 
          variant="cyber" 
          size="lg" 
          className="w-full text-md h-12"
          onClick={() => navigate('/seed')}
        >
          <Wallet className="mr-2 h-4 w-4" />
          Create New Vault
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          className="w-full h-12 border-slate-700 hover:bg-slate-800 hover:text-slate-200"
        >
          Import Seed Phrase
        </Button>
      </div>

      <p className="text-xs text-slate-600">
        Powered by Kyber-768 & Ed25519
      </p>
    </div>
  );
}

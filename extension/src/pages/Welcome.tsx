import { Shield, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center space-y-8 animate-fade-in font-sans">

      <div className="space-y-4">
        <div className="mx-auto w-20 h-20 bg-secondary rounded-2xl flex items-center justify-center mb-6 ring-1 ring-white/10">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-5xl font-bold tracking-tighter text-foreground">
          QCash
        </h1>
        <p className="text-muted-foreground text-lg max-w-[280px] mx-auto leading-relaxed">
          Quantum-Safe Privacy Wallet on Solana
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button
          size="lg"
          className="w-full text-md h-12 font-semibold bg-primary text-primary-foreground hover:bg-white/90"
          onClick={() => navigate('/seed')}
        >
          <Wallet className="mr-2 h-5 w-5" />
          Create New Wallet
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full h-12 border-border bg-transparent text-foreground hover:bg-secondary hover:text-foreground"
        >
          Import Seed Phrase
        </Button>
      </div>
    </div>
  );
}

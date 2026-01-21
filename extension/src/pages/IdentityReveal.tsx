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
  const truncate = (str: string, len = 12) =>
    `${str.slice(0, len)}...${str.slice(-len)}`;

  return (
    <div className="min-h-screen bg-background p-4 text-foreground flex flex-col items-center justify-center font-sans space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold mb-2 text-foreground">
            Your Dual Identity
        </h1>
        <p className="text-muted-foreground text-center text-sm font-medium">
        </p>
      </div>

      <div className="w-full max-w-md space-y-5">
        {/* Card 1: Public Solana */}
        <Card className="bg-background border border-border p-5 relative overflow-hidden group hover:border-foreground/50 transition-all">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-secondary rounded-lg">
                    <Wallet className="w-5 h-5 text-foreground" />
                </div>
                <span className="font-bold text-foreground">Public Solana Address</span>
            </div>

            <div className="bg-secondary/40 border border-border p-3 rounded-lg font-mono text-xs text-muted-foreground flex justify-between items-center group-hover:bg-secondary/60 transition-colors">
                <span className="truncate mr-2">{truncate(wallet.solana_address)}</span>
                <Copy className="w-4 h-4 cursor-pointer hover:text-foreground transition-colors" />
            </div>
        </Card>

        {/* Card 2: Private Vault */}
        <Card className="bg-background border border-border p-5 relative overflow-hidden group hover:border-foreground/50 transition-all">

            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-secondary rounded-lg">
                    <Shield className="w-5 h-5 text-foreground" />
                </div>
                <span className="font-bold text-foreground">Private Vault Key</span>
            </div>

            <div className="bg-secondary/40 border border-border p-3 rounded-lg font-mono text-xs text-muted-foreground flex justify-between items-center break-all group-hover:bg-secondary/60 transition-colors">
                {/* Kyber keys are huge, maybe show a smaller slice */}
                <span className="truncate mr-2">{truncate(wallet.kyber_pubkey, 12)}</span>
                <Copy className="w-4 h-4 cursor-pointer hover:text-foreground transition-colors" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 italic opacity-80">
                This key allows you to receive assets privately using Zero-Knowledge proofs.
            </p>
        </Card>
      </div>

      <Button
        onClick={() => navigate('/dashboard')}
        size="lg"
        className="w-full max-w-md bg-white hover:bg-white/90 text-black font-semibold h-12 shadow-sm"
      >
        Enter Dashboard <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );
}

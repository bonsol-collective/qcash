import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useKeyManager } from '../hooks/useKeyManager';
import { Copy, CheckCircle2, Shield, Zap, Info } from 'lucide-react';

export default function IdentityReveal() {
  const navigate = useNavigate();
  const { keys } = useKeyManager();
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedVault, setCopiedVault] = useState(false);

  // If accessed directly without keys (in a real app, use context/store)
  // For prototype, we might rely on the hook's localStorage persistence logic or just mock checks
  
  const copyToClipboard = (text: string, isVault: boolean) => {
    navigator.clipboard.writeText(text);
    if (isVault) {
      setCopiedVault(true);
      setTimeout(() => setCopiedVault(false), 2000);
    } else {
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-6 animate-fade-in max-w-md mx-auto pb-24">
      <div className="w-full space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">
            Dual Identity Created
          </h2>
          <p className="text-sm text-slate-400">
            Your single seed manages both your public and private lives.
          </p>
        </div>

        {/* Public Identity Card */}
        <Card className="border-violet-900/50 bg-slate-900/80 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
            <Zap className="w-16 h-16 text-violet-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-violet-400 flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-violet-500/10">
                <Zap className="w-4 h-4" />
              </div>
              Public Address (Solana)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 flex justify-between items-center">
              <code className="text-sm text-slate-300 font-mono">
                {keys ? keys.publicAddress : "Loading..."}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-violet-400"
                onClick={() => keys && copyToClipboard(keys.publicAddress, false)}
              >
                {copiedPublic ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Use this for gas fees and public interactions. Fully transparent on-chain.
            </p>
          </CardContent>
        </Card>

        {/* Private Vault Card */}
        <Card className="border-cyan-900/50 bg-slate-900/80 overflow-hidden relative group shadow-[0_0_30px_rgba(6,182,212,0.1)]">
          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
             <Shield className="w-16 h-16 text-cyan-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                <Shield className="w-4 h-4" />
              </div>
              Private Vault Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-slate-950/50 border border-cyan-900/30 rounded-lg p-3 flex justify-between items-center">
              <code className="text-sm text-cyan-100 font-mono tracking-wide">
                {keys ? keys.vaultKey : "Loading..."}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-cyan-500 hover:text-cyan-300 hover:bg-cyan-950/30"
                onClick={() => keys && copyToClipboard(keys.vaultKey, true)}
              >
                {copiedVault ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            
            <div className="flex gap-2 items-start p-2 rounded bg-cyan-950/20 border border-cyan-900/20">
              <Info className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
              <p className="text-xs text-cyan-200/80">
                This is your <strong>Shielded Receiver Address</strong>. Use it to receive assets privately via Zero-Knowledge transfers.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
          <Button 
            variant="cyber" 
            className="w-full h-12 text-md shadow-lg shadow-cyan-900/20"
            onClick={() => navigate('/dashboard')}
          >
            Enter Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

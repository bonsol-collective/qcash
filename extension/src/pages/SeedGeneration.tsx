import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useKeyManager } from '../hooks/useKeyManager';
import { Copy, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SeedGeneration() {
  const navigate = useNavigate();
  const { generateKeys, keys } = useKeyManager();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    generateKeys();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = keys?.seedPhrase.split(' ') || Array(12).fill('loading');

  const copyToClipboard = () => {
    if (keys?.seedPhrase) {
      navigator.clipboard.writeText(keys.seedPhrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-6 animate-fade-in max-w-md mx-auto">
      <div className="w-full space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">
            Backup Your Seed
          </h2>
          <p className="text-sm text-slate-400">
            These 12 words are the only way to recover your funds.
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 backdrop-blur-md">
          <CardContent className="p-4">
            <div 
              className={cn(
                "grid grid-cols-3 gap-2 relative transition-all duration-300",
                !revealed && "cursor-pointer"
              )}
              onClick={() => !revealed && setRevealed(true)}
            >
              {!revealed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-950/60 backdrop-blur-sm rounded-lg border border-slate-700/50 transition-opacity hover:bg-slate-950/50">
                   <Eye className="w-8 h-8 text-cyan-400 mb-2" />
                   <span className="text-sm font-medium text-cyan-400">Click to Reveal</span>
                </div>
              )}
              
              {words.map((word, i) => (
                <div 
                  key={i} 
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 flex items-center gap-2"
                >
                  <span className="text-xs text-slate-600 select-none w-4">{i + 1}.</span>
                  <span className={cn("text-sm font-mono text-slate-200", !revealed && "blur-sm")}>
                    {word}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-400 hover:text-white"
                onClick={() => setRevealed(!revealed)}
              >
                {revealed ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {revealed ? 'Hide' : 'Show'}
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className={cn("border-slate-700", copied && "text-emerald-400 border-emerald-900 bg-emerald-950/30")}
                onClick={copyToClipboard}
              >
                {copied ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied' : 'Copy Words'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/50 cursor-pointer hover:border-slate-700 transition-colors">
            <input 
              type="checkbox" 
              className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span className="text-sm text-slate-300 select-none">
              I have saved these words safely. I understand that if I lose them, I lose access to my wallet forever.
            </span>
          </label>

          <Button 
            variant="cyber" 
            className="w-full h-12 text-md" 
            disabled={!confirmed || !keys}
            onClick={() => navigate('/reveal')}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

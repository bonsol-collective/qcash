import { Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useWallet } from '../context/WalletContext';
import { useWasm } from '../hooks/useWasm';

export default function SeedGeneration() {
  const navigate = useNavigate();
  const { isReady, createIdentity } = useWasm();
  const { setWallet } = useWallet();

  const [mnemonicList, setMnemonicList] = useState<string[]>([]);
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isReady) {
      generate();
    }
  }, [isReady]);

  const generate = async () => {
    try {
      const newWallet = await createIdentity();
      console.log("Wallet Generated:", newWallet);
      setWallet(newWallet);
      setMnemonicList(newWallet.mnemonic.split(' '));
      setLoading(false);
    } catch (e) {
      console.error("Keygen failed", e);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonicList.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
        <p className="mt-4 text-slate-400 font-mono tracking-widest">GENERATING QUANTUM KEYS...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 flex flex-col items-center relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[100px] rounded-full"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[100px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">
            Recovery Phrase
          </h2>
          <p className="text-sm text-slate-400 px-4">
            Write down these 12 words in order and keep them somewhere safe. You'll need them to recover your vault.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full my-6">
          {mnemonicList.map((word, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 p-2.5 rounded-lg text-center text-sm font-mono group hover:border-slate-700 transition-colors">
               <span className="text-slate-600 mr-2 text-xs">{i+1}.</span>
               <span className="text-slate-200">{word}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-slate-400 hover:text-cyan-400 transition-colors"
          >
            {copied ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Copied!</>
            ) : (
              <><Copy className="w-4 h-4 mr-2" /> Copy to Clipboard</>
            )}
          </Button>
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex items-start gap-3 p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
            <input
                type="checkbox"
                id="safe"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
            />
            <label htmlFor="safe" className="text-sm text-slate-400 cursor-pointer leading-tight">
                I understand that if I lose these words, I will lose access to my vault and it cannot be recovered.
            </label>
          </div>

          <Button
            disabled={!isChecked}
            onClick={() => navigate('/reveal')}
            variant="cyber"
            className="w-full h-12 text-md"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

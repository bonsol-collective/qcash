import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useWallet } from "../context/WalletContext";
import { useWasm } from "../hooks/useWasm";

export default function SeedGeneration() {
  const navigate = useNavigate();
  const { isReady, createIdentity } = useWasm();
  const { wallet, setWallet } = useWallet();

  const [isChecked, setIsChecked] = useState(false);
  const loading = !wallet;
  const [copied, setCopied] = useState(false);

  const mnemonicList = useMemo(() => {
    return wallet?.mnemonic.split(" ") ?? [];
  }, [wallet]);

  const generate = async () => {
    try {
      const newWallet = await createIdentity();
      setWallet(newWallet);
    } catch (e) {
      console.error("Keygen failed", e);
    }
  };

  useEffect(() => {
    if (!isReady || wallet) return;
    generate();
  }, [isReady, wallet]);

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonicList.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground font-sans">
        <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
        </div>
        <p className="mt-8 text-muted-foreground font-mono tracking-widest text-sm animate-pulse">
          GENERATING QUANTUM KEYS...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground flex flex-col items-center relative overflow-hidden font-sans">

      <div className="w-full max-w-md space-y-8 animate-fade-in py-10">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-foreground">
            Recovery Phrase
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            Write down these 12 words in order and keep them somewhere safe.
            You'll need them to recover your vault.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full my-6 bg-secondary/30 p-4 rounded-xl border border-border">
          {mnemonicList.map((word, i) => (
            <div
              key={i}
              className="bg-background border border-border p-2.5 rounded-lg text-center text-sm font-mono group hover:border-primary/50 transition-all"
            >
              <span className="text-muted-foreground mr-2 text-[10px] opacity-70">{i + 1}.</span>
              <span className="text-foreground font-medium">{word}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors hover:bg-secondary"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" /> Copy to Clipboard
              </>
            )}
          </Button>
        </div>

        <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3 p-4 bg-secondary/10 border border-border rounded-xl">
            <input
              type="checkbox"
              id="safe"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer accent-primary"
            />
            <label
              htmlFor="safe"
              className="text-xs text-muted-foreground cursor-pointer leading-relaxed hover:text-foreground transition-colors"
            >
              I understand that if I lose these words, I will lose access to my
              vault and it cannot be recovered.
            </label>
          </div>

          <Button
            disabled={!isChecked}
            onClick={() => navigate("/reveal")}
            className="w-full h-12 text-md font-semibold bg-primary hover:bg-white/90 text-primary-foreground disabled:opacity-50 transition-all"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

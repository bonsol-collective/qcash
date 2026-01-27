import axios from 'axios';
import { ArrowRight, CheckCircle2, Droplets, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';

function App() {
  const [vaultPda, setVaultPda] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleAirdrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultPda) return;

    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      await axios.post('http://localhost:3000/airdrop', {
        address: vaultPda
      });

      setStatus('success');
      setMessage('Airdrop successful! UTXOs have been sent to your vault.');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setMessage(error.response?.data?.error || 'Failed to request airdrop. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 selection:bg-white/10">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>

      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="rounded-full bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur-xl">
            <Droplets className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">QCash Faucet</h1>
          <p className="text-muted-foreground">
            Enter your Kyber Key Vault PDA to receive devnet UTXOs.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md shadow-2xl ring-1 ring-white/5">
          <form onSubmit={handleAirdrop} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="vault-pda" className="text-sm font-medium text-white">
                Vault PDA
              </label>
              <input
                id="vault-pda"
                type="text"
                value={vaultPda}
                onChange={(e) => setVaultPda(e.target.value)}
                placeholder="Enter your Vault PDA address..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-neutral-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-neutral-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Request Airdrop
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Status Messages */}
          {status !== 'idle' && (
            <div className={`mt-6 rounded-lg border p-4 ${status === 'success'
              ? 'border-green-500/20 bg-green-500/10 text-green-400'
              : 'border-red-500/20 bg-red-500/10 text-red-400'
              } animate-fade-in`}>
              <div className="flex items-start gap-3">
                {status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0" />
                )}
                <div className="text-sm">
                  <p className="font-medium">{status === 'success' ? 'Success' : 'Error'}</p>
                  <p className="mt-1 text-white/70">{message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

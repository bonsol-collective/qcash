import type { PublicKey } from '@solana/web3.js';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle, Copy, Database, Key, Loader2, RefreshCw, Send, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FundWalletCard } from '../components/FundWalletCard';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useWallet } from '../context/WalletContext';
import { InsufficientFundsError, useSolana } from '../hooks/useSolana';
import { SendTokenModal } from '../components/SendTokenModal';
import { useLedgerSync } from '../hooks/useLedgerSync';

export default function Dashboard() {
    const { wallet } = useWallet();
    const { registerVault, getVaultState, getSolBalance } = useSolana();
    const { balance: privateBalance, utxos, isSyncing, syncNow } = useLedgerSync();

    const [status, setStatus] = useState<'checking' | 'idle' | 'loading' | 'success' | 'registered' | 'error' | 'needs-funds'>('checking');
    const [txSig, setTxSig] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [vaultAddress, setVaultAddress] = useState<PublicKey | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);

    // Check for Vault Existence on Mount
    useEffect(() => {
        const checkVault = async () => {
            try {
                const bal = await getSolBalance();
                setBalance(bal);

                const existingAddress = await getVaultState();
                console.log("Existing Address:", existingAddress);
                if (existingAddress) {
                    setVaultAddress(existingAddress);
                    setStatus('registered');
                } else {
                    setStatus('idle');
                }
            } catch (e) {
                console.error("Failed to check vault:", e);
                setStatus('idle');
            }
        };
        checkVault();
    }, [wallet]);

    const handleRegister = async () => {
        try {
            setStatus('loading');
            setErrorMsg("");
            const sig = await registerVault();
            setTxSig(sig);
            setStatus('success');

            // Re-fetch to confirm and show the address
            const addr = await getVaultState();
            if (addr) setVaultAddress(addr);

            // Auto-transition to registered state after 3 seconds
            setTimeout(() => setStatus('registered'), 3000);

        } catch (e: any) {
            console.error(e);
            if (e instanceof InsufficientFundsError) {
                setStatus('needs-funds');
            } else {
                setErrorMsg(e.message || "Unknown error");
                setStatus('error');
            }
        }
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    if (!wallet) return <div className="p-10 text-center font-sans text-muted-foreground">No Wallet Loaded</div>;

    return (
        <div className="min-h-screen bg-background p-4 text-foreground font-sans flex flex-col items-center gap-6 selection:bg-white/20">
            <header className="w-full max-w-md flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-xl font-bold tracking-tight text-foreground">
                        QCash Wallet
                    </h1>
                    <p className="text-muted-foreground text-xs font-medium">Post-Quantum Solana Storage</p>
                </div>
                {status === 'registered' && (
                    <Button
                        onClick={() => setIsSendModalOpen(true)}
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-white/90 gap-2 font-semibold shadow-sm"
                    >
                        <Send className="w-3.5 h-3.5" /> Send
                    </Button>
                )}
            </header>

            <Card className="w-full max-w-md p-0 overflow-hidden shadow-sm border border-border bg-background">
                <div className="p-5 space-y-5">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-foreground" />
                        Your Identity
                    </h2>

                    {/* Solana Address */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <Wallet className="w-3.5 h-3.5" /> Solana Address
                        </label>
                        <div className="flex gap-2 group">
                            <code className="flex-1 bg-secondary/30 border border-border rounded-lg p-3 text-xs font-mono text-foreground truncate select-all transition-colors">
                                {wallet.solana_address}
                            </code>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 shrink-0 hover:bg-secondary hover:text-foreground transition-colors rounded-lg border border-transparent"
                                onClick={() => copyToClipboard(wallet.solana_address, 'sol')}
                            >
                                {copiedField === 'sol' ? <CheckCircle className="w-4 h-4 text-foreground" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* Kyber Key */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <Key className="w-3.5 h-3.5 text-foreground" /> Kyber-768 Key (Quantum)
                        </label>
                        <div className="flex gap-2 group">
                            <code className="flex-1 bg-secondary/30 border border-border rounded-lg p-3 text-xs font-mono text-foreground truncate select-all transition-colors">
                                {wallet.kyber_pubkey}
                            </code>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 shrink-0 hover:bg-secondary hover:text-foreground transition-colors rounded-lg border border-transparent"
                                onClick={() => copyToClipboard(wallet.kyber_pubkey, 'kyber')}
                            >
                                {copiedField === 'kyber' ? <CheckCircle className="w-4 h-4 text-foreground" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* Vault Address */}
                    {(status === 'registered' || status === 'success') && vaultAddress && (
                        <div className="space-y-1.5 pt-4 border-t border-border">
                            <label className="text-xs text-foreground flex items-center gap-2 font-bold">
                                <Database className="w-3.5 h-3.5" /> On-Chain Vault PDA (Active)
                            </label>
                            <div className="flex gap-2 group">
                                <code className="flex-1 bg-secondary/30 border border-border rounded-lg p-3 text-xs font-mono text-foreground truncate select-all transition-colors">
                                    {vaultAddress.toString()}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 shrink-0 hover:bg-secondary hover:text-foreground transition-colors rounded-lg border border-transparent"
                                    onClick={() => copyToClipboard(vaultAddress.toString(), 'pda')}
                                >
                                    {copiedField === 'pda' ? <CheckCircle className="w-4 h-4 text-foreground" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Balance Footer */}
                <div className="bg-secondary/10 p-4 border-t border-border flex justify-between items-center px-6">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5" /> Balance
                    </div>
                    <div className="font-mono font-bold text-lg text-foreground">
                        {balance !== null ? `${(balance / 1e9).toFixed(4)} SOL` : <span className="text-xs text-muted-foreground">Loading...</span>}
                    </div>
                </div>
            </Card>

            {/* --- STATUS SECTION --- */}
            {status === 'checking' ? (
                <div className="flex items-center text-muted-foreground text-sm font-medium animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Connecting to Solana...
                </div>
            ) : status === 'needs-funds' ? (
                <FundWalletCard
                    address={wallet.solana_address}
                    minRequired="0.01"
                    onRetry={handleRegister}
                />
            ) : status === 'registered' ? (
                <div className="w-full max-w-md p-4 bg-secondary/20 border border-border rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-secondary/40 rounded-full">
                            <CheckCircle className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                            <p className="text-foreground font-bold text-sm">System Ready</p>
                            <p className="text-muted-foreground text-xs">Vault is active and secure.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <Card className="w-full max-w-md p-6 space-y-4 shadow-sm border border-border bg-background">
                    <h2 className="text-lg font-bold text-foreground">System Status</h2>

                    {status === 'idle' && (
                        <div className="p-4 bg-secondary/30 rounded-xl border border-border flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-muted-foreground">Vault not registered</span>
                            <Button size="sm" onClick={handleRegister} className="bg-foreground hover:bg-foreground/90 text-background font-medium border border-border">
                                Register On-Chain
                            </Button>
                        </div>
                    )}

                    {status === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-8 text-foreground space-y-4">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 animate-spin relative z-10" />
                            </div>
                            <span className="text-sm font-medium animate-pulse">Registering Quantum Vault...</span>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="p-4 bg-secondary/20 border border-border rounded-xl space-y-3">
                            <div className="flex items-center text-foreground font-bold">
                                <CheckCircle className="w-5 h-5 mr-2 text-foreground" />
                                Vault Registered!
                            </div>
                            <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Tx Signature:</span>
                                <div className="font-mono mt-1.5 break-all bg-secondary/40 border border-border p-2.5 rounded-lg text-foreground select-all">
                                    {txSig}
                                </div>
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="p-4 bg-secondary/20 border border-border rounded-xl flex flex-col gap-2 text-foreground text-sm">
                            <div className="flex items-center font-bold">
                                <AlertTriangle className="w-5 h-5 mr-2 text-foreground" />
                                Registration Failed
                            </div>
                            <p className="text-xs text-muted-foreground pl-7">{errorMsg}</p>
                            <Button variant="outline" size="sm" onClick={() => setStatus('idle')} className="mt-2 w-full border-border text-foreground hover:bg-secondary bg-transparent">
                                Try Again
                            </Button>
                        </div>
                    )}

                </Card>
            )}

            {/* Private Balance Section - Only show when vault is registered */}
            {status === 'registered' && (
                <Card className="w-full max-w-md shadow-sm border border-border bg-background">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Private Balance
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                                {utxos.length} UTXOs
                            </span>
                            <div className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={syncNow}
                                disabled={isSyncing}
                                className="hover:bg-secondary text-muted-foreground h-8 w-8"
                            >
                                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight text-foreground">
                            {privateBalance} <span className="text-lg text-muted-foreground">QCASH</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Transaction List - Only show when vault is registered */}
            {status === 'registered' && (
                <div className="w-full max-w-md space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">Recent Activity</h3>

                    {utxos.length === 0 ? (
                        <div className="text-center py-8 bg-secondary/20 rounded-lg border border-border">
                            <p className="text-sm text-muted-foreground">No encrypted notes found.</p>
                            <Button variant="link" onClick={syncNow} className="text-primary text-xs">
                                Scan Ledger
                            </Button>
                        </div>
                    ) : (
                        utxos.map((utxo) => (
                            <div
                                key={utxo.index}
                                className="flex justify-between items-center p-3 bg-secondary/20 border border-border rounded-lg hover:border-muted-foreground/30 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${utxo.isReturn ? 'bg-secondary text-muted-foreground' : 'bg-green-900/30 text-green-500'}`}>
                                        {utxo.isReturn ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm text-foreground">
                                            {utxo.isReturn ? "Change Return" : "Received"}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Block Index #{utxo.index}
                                        </div>
                                    </div>
                                </div>
                                <div className="font-mono font-medium text-foreground">
                                    + {utxo.amount}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <SendTokenModal
                isOpen={isSendModalOpen}
                onClose={() => setIsSendModalOpen(false)}
            />
        </div>
    );
}

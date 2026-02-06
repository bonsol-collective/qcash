import type { PublicKey } from '@solana/web3.js';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle, Clock, Copy, Database, ExternalLink, History, Home, Key, Loader2, RefreshCw, Send, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FundWalletCard } from '../components/FundWalletCard';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useWallet } from '../context/WalletContext';
import { InsufficientFundsError, useSolana } from '../hooks/useSolana';
import { SendTokenModal } from '../components/SendTokenModal';
import { useLedgerSync } from '../hooks/useLedgerSync';
import { isTabMode, openInTab } from '../lib/popout';

export default function Dashboard() {
    const { wallet } = useWallet();
    const { registerVault, getVaultState, getSolBalance } = useSolana();
    const { balance: privateBalance, pendingBalance, utxos, isSyncing, syncNow } = useLedgerSync();

    const [status, setStatus] = useState<'checking' | 'idle' | 'loading' | 'success' | 'registered' | 'error' | 'needs-funds'>('checking');
    const [txSig, setTxSig] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [vaultAddress, setVaultAddress] = useState<PublicKey | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [balance, setBalance] = useState<number | null>(null);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'home' | 'activity'>('home');

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

    // Auto-sync when extension opens and vault is registered
    useEffect(() => {
        if (status === 'registered' && !isSyncing) {
            console.log("Auto-syncing on startup...");
            syncNow();
        }
    }, [status]); // Only trigger when status changes to 'registered'

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
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col selection:bg-white/20">
            {/* Scrollable Main Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-20 flex flex-col items-center gap-6">
                <header className="w-full max-w-md flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-xl font-bold tracking-tight text-foreground">
                            QCash Wallet
                        </h1>
                        <p className="text-muted-foreground text-xs font-medium">Post-Quantum Solana Storage</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {status === 'registered' && (
                            <Button
                                onClick={() => setIsSendModalOpen(true)}
                                size="sm"
                                className="bg-primary text-primary-foreground hover:bg-white/90 gap-2 font-semibold shadow-sm"
                            >
                                <Send className="w-3.5 h-3.5" /> Send
                            </Button>
                        )}
                        {!isTabMode() && (
                            <Button
                                onClick={openInTab}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                                title="Open in tab"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </header>

                {/* Dual Balance Display - Side by Side - Home tab only */}
                {status === 'registered' && activeTab === 'home' && (
                    <div className="w-full max-w-md grid grid-cols-2 gap-3">
                        {/* SOL Balance */}
                        <div className="bg-secondary/20 border border-border rounded-xl p-4">
                            <div className="text-xs font-medium text-muted-foreground flex items-center gap-2 mb-3 mt-2">
                                <Wallet className="w-3.5 h-3.5" /> SOL Balance
                            </div>
                            <div className="font-mono font-bold text-xl text-foreground">
                                {balance !== null ? (balance / 1e9).toFixed(4) : "..."}
                            </div>
                        </div>
                        {/* Private Balance */}
                        <div className="bg-secondary/20 border border-border rounded-xl p-4">
                            <div className="text-xs font-medium text-muted-foreground flex items-center gap-2 mb-1">
                                <ShieldCheck className="w-3.5 h-3.5" /> Private
                                <div className={`h-2 w-2 rounded-full ml-auto ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
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
                            <div className="font-mono font-bold text-xl text-foreground flex items-baseline gap-1">
                                {privateBalance} <span className="text-sm text-muted-foreground">QCASH</span>
                            </div>
                            {pendingBalance > 0 && (
                                <div className="text-xs text-yellow-500 flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3" /> +{pendingBalance} pending
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {activeTab === 'home' && (
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
                    </Card>
                )}

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
                    null
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

                {/* Transaction List - Only show when vault is registered AND on activity tab */}
                {status === 'registered' && activeTab === 'activity' && (
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
                                    key={utxo.utxoHashHex}
                                    className={`flex justify-between items-center p-3 border rounded-lg hover:border-muted-foreground/30 transition-colors ${utxo.status === 'pending' ? 'bg-yellow-900/10 border-yellow-800/30' : 'bg-secondary/20 border-border'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${utxo.status === 'pending'
                                            ? 'bg-yellow-900/30 text-yellow-500'
                                            : utxo.isReturn
                                                ? 'bg-secondary text-muted-foreground'
                                                : 'bg-green-900/30 text-green-500'
                                            }`}>
                                            {utxo.status === 'pending'
                                                ? <Clock className="h-4 w-4" />
                                                : utxo.isReturn
                                                    ? <ArrowUpRight className="h-4 w-4" />
                                                    : <ArrowDownLeft className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-foreground flex items-center gap-2">
                                                {utxo.status === 'pending'
                                                    ? 'Pending Attestation'
                                                    : utxo.isReturn
                                                        ? 'Change Return'
                                                        : 'Received'}
                                                {utxo.status === 'finalized' && (
                                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {utxo.status === 'pending' ? 'Awaiting prover votes' : `Index #${utxo.index}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`font-mono font-medium ${utxo.status === 'pending' ? 'text-yellow-500' : 'text-foreground'
                                        }`}>
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

            {/* Bottom Tab Bar - Only show when registered */}
            {status === 'registered' && (
                <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-2">
                    <div className="max-w-md mx-auto flex justify-around">
                        <button
                            onClick={() => setActiveTab('home')}
                            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${activeTab === 'home'
                                ? 'text-foreground bg-secondary/40'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/20'
                                }`}
                        >
                            <Home className="w-5 h-5" />
                            <span className="text-xs font-medium">Home</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('activity')}
                            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors relative ${activeTab === 'activity'
                                ? 'text-foreground bg-secondary/40'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/20'
                                }`}
                        >
                            <History className="w-5 h-5" />
                            <span className="text-xs font-medium">Activity</span>
                            {utxos.length > 0 && activeTab !== 'activity' && (
                                <span className="absolute top-1 right-4 h-2 w-2 bg-primary rounded-full" />
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

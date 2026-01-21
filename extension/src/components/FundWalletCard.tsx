import { AlertCircle, Copy, RefreshCw, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface FundWalletCardProps {
    address: string;
    minRequired: string;
    onRetry: () => void;
}

export function FundWalletCard({ address, minRequired, onRetry }: FundWalletCardProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="w-full max-w-md bg-slate-900 border-yellow-800/50 p-6 space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-yellow-900/20 rounded-lg">
                    <Wallet className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-100">Deposit SOL</h3>
                    <p className="text-sm text-slate-400">
                        You need at least <span className="text-slate-200 font-mono">{minRequired} SOL</span> to initialize your vault.
                    </p>
                </div>
            </div>

            <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
                <span className="text-xs uppercase text-slate-500 font-bold tracking-wider">Your Address</span>
                <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono text-cyan-400 break-all">{address}</code>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCopy}
                        className="hover:bg-slate-800 h-8 w-8 shrink-0"
                    >
                        {copied ? <span className="text-emerald-400 text-xs">✓</span> : <Copy className="w-4 h-4 text-slate-400" />}
                    </Button>
                </div>
            </div>

            <div className="bg-yellow-950/30 p-3 rounded flex items-center gap-2 text-xs text-yellow-200/80 border border-yellow-900/30">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Transfers usually take 10-30 seconds to arrive.</span>
            </div>

            <Button onClick={onRetry} className="w-full bg-cyan-600 hover:bg-cyan-500">
                <RefreshCw className="w-4 h-4 mr-2" />
                I've Sent Funds - Try Again
            </Button>
        </Card>
    );
}

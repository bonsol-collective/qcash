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
        <Card className="w-full max-w-md bg-background border border-border p-5 space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-secondary rounded-lg">
                    <Wallet className="w-6 h-6 text-foreground" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-foreground">Deposit SOL</h3>
                    <p className="text-sm text-muted-foreground">
                        You need at least <span className="text-foreground font-mono">{minRequired} SOL</span> to initialize your vault.
                    </p>
                </div>
            </div>

            <div className="bg-secondary/30 p-4 rounded border border-border space-y-2">
                <span className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Your Address</span>
                <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono text-foreground break-all">{address}</code>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCopy}
                        className="hover:bg-secondary h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                        {copied ? <span className="text-foreground text-xs font-bold">✓</span> : <Copy className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            <div className="bg-secondary/20 p-3 rounded flex items-center gap-2 text-xs text-muted-foreground border border-border">
                <AlertCircle className="w-4 h-4 shrink-0 text-foreground" />
                <span>Transfers usually take 10-30 seconds to arrive.</span>
            </div>

            <Button onClick={onRetry} className="w-full bg-primary hover:bg-white/90 text-primary-foreground font-semibold shadow-sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                I've Sent Funds - Try Again
            </Button>
        </Card>
    );
}

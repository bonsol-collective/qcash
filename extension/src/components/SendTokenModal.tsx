import { Send, X, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { useTransfer } from '../hooks/useTransfer';

interface SendTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SendTokenModal({ isOpen, onClose }: SendTokenModalProps) {
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { prepareTransaction, executeSend, status } = useTransfer();

    const handleSend = async () => {
        if (!amount || !recipient) return;

        setIsLoading(true);

        try {
            await executeSend(Number(amount), recipient);
            onClose();
        } catch (err) {
            // TODO: Show Toast
            console.error("Send failed:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && recipient.length >= 32) {
            const timer = setTimeout(() => {
                prepareTransaction(recipient);
            }, 500)

            return () => clearTimeout(timer);
        }
    }, [recipient, prepareTransaction, isOpen]); 

    if (!isOpen) return null;

    const getButtonText = () => {
        if (isLoading) return "Processing...";
        if (status === "preparing") return "Syncing Ledger...";
        if (status === "encrypting") return "Encrypting...";
        if (status === "proving") return "Generating Proof...";
        if (status === "submitting") return "Submitting...";
        return "Send QCash";
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-md p-6 space-y-6 shadow-xl border border-border bg-background relative animate-in zoom-in-95 duration-200">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-4 h-6 w-6 rounded-full opacity-70 hover:opacity-100"
                    onClick={onClose}
                    disabled={isLoading}
                >
                    <X className="h-4 w-4" />
                </Button>

                <div className="space-y-1">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Send className="w-5 h-5" />
                        Send QCash
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Securely transfer assets to another vault.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Recipient Vault (PDA)
                        </label>
                        <Input
                            placeholder="Paste Recipient's Vault Address"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            disabled={isLoading}
                            className="font-mono text-sm bg-secondary/20 border-border focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Amount
                        </label>
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={isLoading}
                                className="bg-secondary/20 border-border focus-visible:ring-offset-0 focus-visible:ring-1 focus-visible:ring-white pr-16"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                                QCASH
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <Button
                            className="w-full bg-primary hover:bg-white/90 text-primary-foreground font-semibold h-11"
                            onClick={handleSend}
                            disabled={!recipient || !amount || (status !== "ready" && !isLoading && status !== "idle") || isLoading}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {getButtonText()}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}

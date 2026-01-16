import React from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Settings, 
  RefreshCw, 
  ShieldCheck,
  Wallet
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Dashboard() {
  return (
    <div className="flex flex-col min-h-screen animate-fade-in bg-slate-950 pb-20">
      {/* Header */}
      <header className="flex justify-between items-center p-4 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
          <span className="text-xs font-medium text-emerald-400">Solana Devnet</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded-full border border-slate-800">
             <RefreshCw className="w-3 h-3 animate-spin-slow" />
             <span>Synced</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
              Q
            </div>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4 space-y-6 flex-1">
        
        {/* Vault Status Banner */}
        <div className="bg-gradient-to-r from-violet-900/20 to-cyan-900/20 border border-indigo-500/30 rounded-lg p-3 flex items-center gap-3">
           <ShieldCheck className="w-5 h-5 text-indigo-400" />
           <div className="flex-1">
             <h4 className="text-sm font-medium text-indigo-100">Vault Active</h4>
             <p className="text-xs text-indigo-300/70">Zero-Knowledge circuit ready.</p>
           </div>
        </div>

        {/* Balance Section */}
        <div className="text-center py-6 space-y-1">
           <span className="text-sm text-slate-400">Total Balance</span>
           <h1 className="text-5xl font-bold tracking-tight text-white">
             $1,240.50
           </h1>
           <div className="flex justify-center gap-4 mt-4 text-xs font-medium">
             <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
               <Wallet className="w-3 h-3" />
               <span>Public: $40.50</span>
             </div>
             <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
               <ShieldCheck className="w-3 h-3" />
               <span>Private: $1,200.00</span>
             </div>
           </div>
        </div>

        {/* Action Bar */}
        <div className="grid grid-cols-4 gap-3">
          <ActionButton icon={<ArrowUpRight />} label="Send" variant="primary" />
          <ActionButton icon={<ArrowDownLeft />} label="Receive" />
          <ActionButton icon={<History />} label="History" />
          <ActionButton icon={<Settings />} label="Manage" />
        </div>

        {/* Recent Activity / Assets */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 px-1">Assets</h3>
          <AssetRow 
            name="Solana" 
            ticker="SOL" 
            amount="0.45" 
            value="$40.50" 
            icon={<div className="w-8 h-8 rounded-full bg-black border border-violet-500/50 flex items-center justify-center">S</div>}
          />
          <AssetRow 
            name="USDC (Shielded)" 
            ticker="zUSDC" 
            amount="1,200.00" 
            value="$1,200.00" 
            isPrivate
            icon={<div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 font-bold text-xs">$</div>}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, variant = 'default' }: { icon: React.ReactNode, label: string, variant?: 'default' | 'primary' }) {
  return (
    <button className="flex flex-col items-center gap-2 group">
      <div className={cn(
        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg",
        variant === 'primary' 
          ? "bg-gradient-to-br from-violet-600 to-cyan-600 text-white shadow-cyan-900/20 group-hover:shadow-cyan-500/40 group-hover:-translate-y-1"
          : "bg-slate-900 border border-slate-800 text-slate-300 group-hover:bg-slate-800 group-hover:border-slate-700"
      )}>
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" } as any)}
      </div>
      <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200">{label}</span>
    </button>
  );
}

function AssetRow({ name, ticker, amount, value, icon, isPrivate }: any) {
  return (
    <Card className="border-slate-800/50 bg-slate-900/40 hover:bg-slate-900/60 transition-colors">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-slate-200 text-sm">{name}</h4>
              {isPrivate && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  PRIVATE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{ticker}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-medium text-slate-200 text-sm">{amount}</p>
          <p className="text-xs text-slate-500">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

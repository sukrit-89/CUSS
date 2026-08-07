import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, LogOut, Wallet } from 'lucide-react';
import { useWalletStore } from '@/stores/wallet.store';

interface WalletButtonProps {
  /** `primary` for the page's main call to action, `glass` for nav chrome. */
  variant?: 'primary' | 'glass';
  /** Hides the "Connect wallet" label on narrow chrome, leaving the icon. */
  compact?: boolean;
  className?: string;
  /** Overrides the disconnected label, e.g. in the funding step. */
  connectLabel?: string;
}

function truncate(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * The one place the app renders wallet connection.
 *
 * Everything goes through `@/stores/wallet.store`, which owns the Stellar
 * Wallets Kit singleton — mounting this anywhere also restores an existing
 * session, so a connected wallet stays connected across routes and reloads.
 */
export function WalletButton({
  variant = 'glass',
  compact = false,
  className = '',
  connectLabel = 'Connect wallet',
}: WalletButtonProps) {
  const publicKey = useWalletStore((state) => state.publicKey);
  const isChecking = useWalletStore((state) => state.isChecking);
  const error = useWalletStore((state) => state.error);
  const checkWallets = useWalletStore((state) => state.checkWallets);
  const connect = useWalletStore((state) => state.connect);
  const disconnect = useWalletStore((state) => state.disconnect);

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkWallets();
  }, [checkWallets]);

  // A dropdown that ignores outside clicks traps the rest of the page.
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  const copyAddress = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    setMenuOpen(false);
    await disconnect();
  };

  if (!publicKey) {
    const base =
      variant === 'primary'
        ? 'bg-white text-black hover:bg-white/90'
        : 'liquid-glass text-white hover:bg-white/5';

    return (
      <button
        onClick={connect}
        disabled={isChecking}
        title={error ?? undefined}
        className={`rounded-full px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 ${base} ${className}`}
      >
        <Wallet size={16} strokeWidth={1.5} />
        {!compact && <span>{isChecking ? 'Checking wallets...' : connectLabel}</span>}
      </button>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="liquid-glass rounded-full px-4 py-2.5 text-sm text-white flex items-center gap-2 hover:bg-white/5 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
        <span className="font-mono">{truncate(publicKey)}</span>
        <ChevronDown size={13} strokeWidth={1.5} className="text-white/40" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 liquid-glass rounded-xl p-2 z-30 flex flex-col">
          <button
            onClick={copyAddress}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
          >
            {copied ? <Check size={14} className="text-[#22c55e]" /> : <Copy size={14} />}
            {copied ? 'Address copied' : 'Copy address'}
          </button>
          <button
            onClick={handleDisconnect}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors"
          >
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

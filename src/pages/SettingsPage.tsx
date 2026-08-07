import { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Key, Users, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function SettingsPage() {
  const auth = useAuthStore();
  const userEmail = auth.user?.email ?? 'unknown@rerail.app';

  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(auth.user?.id ?? '');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-6 sm:px-8 border-b border-white/10 flex items-center sticky top-0 bg-[#080808]/90 backdrop-blur-md z-10">
          <h1 className="text-white font-medium text-lg">Settings</h1>
        </header>

        <main className="p-6 sm:p-8 flex flex-col gap-8 max-w-2xl">
          {/* Section 1: Account */}
          <div>
            <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
              <Users size={16} strokeWidth={1.5} />
              <span>Account</span>
            </h2>
            <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-white/80 text-sm">{userEmail}</span>
                <span className="liquid-glass rounded-full px-3 py-1 text-xs text-white/60 font-medium">
                  Owner
                </span>
              </div>
              <div className="border-t border-white/5 pt-3">
                <p className="text-white/30 text-xs">
                  Team collaboration is coming in L6. You'll be able to invite admins and
                  developers.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Identifiers */}
          <div>
            <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
              <Key size={16} strokeWidth={1.5} />
              <span>Identifiers</span>
            </h2>
            <div className="liquid-glass rounded-2xl p-6">
              <label className="text-white/50 text-xs block mb-1.5 font-medium">Your User ID</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={auth.user?.id ?? '—'}
                  className="flex-1 liquid-glass rounded-xl px-4 py-2.5 text-white/80 text-sm font-mono outline-none"
                />
                <button
                  onClick={handleCopyKey}
                  className="liquid-glass rounded-xl px-3 py-2.5 text-xs text-white/80 hover:text-white transition-colors"
                >
                  {copiedKey ? <Check size={16} className="text-[#22c55e]" /> : 'Copy'}
                </button>
              </div>
              <p className="text-white/30 text-xs mt-3">
                Every campaign you create is filed under this organizer ID.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

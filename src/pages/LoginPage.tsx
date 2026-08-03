import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Infinity as InfinityIcon, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function LoginPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { signIn, isAuthenticated, user, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setAuthError(null);
      await signIn();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white flex flex-col justify-between items-center p-4 relative">
      <header className="w-full max-w-sm flex justify-start py-4">
        <Link to="/" className="text-white/40 hover:text-white text-xs transition-colors">
          ← Back
        </Link>
      </header>

      <main className="w-full max-w-sm my-auto">
        <div className="liquid-glass rounded-2xl p-8 flex flex-col gap-6">
          {/* Logo Mark */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2 text-white font-medium text-xl">
              <InfinityIcon size={28} strokeWidth={1.5} />
              <span>ReRail</span>
            </div>
            <p className="text-white/40 text-xs">Gasless USDC Payout Infrastructure</p>
          </div>

          {/* Testnet Banner */}
          <div className="liquid-glass rounded-xl p-3 text-center border border-white/10">
            <span className="text-white/70 text-xs font-medium block">
              Stellar Testnet Phase
            </span>
            <span className="text-white/40 text-[11px]">
              Instant access powered by Google OAuth
            </span>
          </div>

          {/* Error display */}
          {authError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
              {authError}
            </div>
          )}

          {/* Primary Google Auth Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full bg-white text-black text-sm font-medium rounded-full px-6 py-3 hover:bg-white/90 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50 shadow-lg cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.761H12.545z"
                />
              </svg>
            )}
            <span>Sign in with Google</span>
          </button>

          <p className="text-white/30 text-xs text-center">
            No password required. Instant wallet setup & payout access.
          </p>
        </div>
      </main>

      <footer className="py-4 text-center text-white/20 text-xs">
        © ReRail Infrastructure Inc.
      </footer>
    </div>
  );
}

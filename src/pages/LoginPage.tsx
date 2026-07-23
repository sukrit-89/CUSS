import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Infinity as InfinityIcon, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Email/Password login is illustrative - prompt user to use Google OAuth
    setAuthError('Please use Google OAuth for instant authentication during the testnet phase.');
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

          {/* Tab Toggle */}
          <div className="liquid-glass rounded-lg p-1 grid grid-cols-2 gap-1">
            <button
              onClick={() => setTab('login')}
              className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === 'login' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === 'signup' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              Sign up
            </button>
          </div>

          {/* Social login */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full bg-white text-black text-sm font-medium rounded-full px-6 py-2.5 hover:bg-white/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.761H12.545z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-white/10" />
            <span className="text-white/30 text-xs">or email</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          {/* Error display */}
          {authError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
              {authError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-white/50 text-xs block mb-1.5 font-medium">Email address</label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full liquid-glass rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="text-white/50 text-xs block mb-1.5 font-medium">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full liquid-glass rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <button
              type="submit"
              className="w-full liquid-glass text-white/70 text-sm font-medium rounded-full px-6 py-2.5 hover:bg-white/5 transition-colors mt-2"
            >
              Continue with Email
            </button>
          </form>

          {/* Forgot Password */}
          <div className="text-center">
            <a href="#forgot" className="text-white/40 hover:text-white text-xs transition-colors">
              Forgot password?
            </a>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-white/20 text-xs">
        © ReRail Infrastructure Inc.
      </footer>
    </div>
  );
}

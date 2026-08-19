import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { ReRailLogo } from '@/components/ReRailLogo';
import { PUBLIC_BG_VIDEO } from '@/config/constants';

type AuthMode = 'login' | 'signup';

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { signIn, signInWithEmail, signUpWithEmail, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setAuthError('Please enter both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      setAuthError(null);
      setSuccessMessage(null);

      if (mode === 'login') {
        await signInWithEmail(email, password);
        navigate('/dashboard');
      } else {
        const result = await signUpWithEmail(email, password);
        if (result.sessionExists) {
          navigate('/dashboard');
        } else {
          setSuccessMessage('Account created! Please check your email inbox to confirm your account.');
        }
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <div className="min-h-screen w-full text-white flex flex-col justify-between items-center p-4 relative overflow-hidden font-sans">
      {/* Background Video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        src={PUBLIC_BG_VIDEO}
      />
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-sm flex justify-start py-4">
        <Link to="/" className="text-white/40 hover:text-white text-xs transition-colors flex items-center gap-1">
          ← Back to home
        </Link>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 w-full max-w-sm my-auto">
        <div className="liquid-glass rounded-2xl p-7 flex flex-col gap-5 border border-white/10">
          {/* Logo & Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2.5 text-white font-medium text-xl">
              <ReRailLogo size={28} className="text-white" />
              <span>ReRail</span>
            </div>
            <h2 className="text-white text-lg font-medium">
              {mode === 'login' ? 'Welcome back' : 'Create an organizer account'}
            </h2>
            <p className="text-white/40 text-xs">
              {mode === 'login'
                ? 'Sign in to manage campaigns and payouts'
                : 'Start distributing USDC gasless payouts'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="liquid-glass rounded-xl p-1 flex items-center text-xs font-medium border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setAuthError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                mode === 'login'
                  ? 'bg-white/15 text-white shadow-sm font-semibold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setAuthError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                mode === 'signup'
                  ? 'bg-white/15 text-white shadow-sm font-semibold'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error display */}
          {authError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center leading-relaxed">
              {authError}
            </div>
          )}

          {/* Success display */}
          {successMessage && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-300 text-xs text-center flex flex-col items-center gap-1">
              <CheckCircle2 size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-white/50 text-[11px] font-medium uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  required
                  placeholder="organizer@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full liquid-glass rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/50 text-[11px] font-medium uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full liquid-glass rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-white text-black text-xs font-medium rounded-full py-3 hover:bg-white/90 transition-colors flex items-center justify-center gap-2 mt-1 disabled:opacity-50 shadow-md cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-0.5">
            <div className="h-[1px] flex-1 bg-white/10" />
            <span className="text-white/30 text-[11px] font-mono">OR</span>
            <div className="h-[1px] flex-1 bg-white/10" />
          </div>

          {/* Google OAuth Alternative */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full liquid-glass border border-white/10 text-white/80 hover:text-white text-xs font-medium rounded-full py-2.5 hover:bg-white/5 transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.761H12.545z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-white/20 text-xs">
        © ReRail Infrastructure Inc.
      </footer>
    </div>
  );
}

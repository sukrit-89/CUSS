import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  BookOpen,
  Home,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { WalletButton } from '@/components/WalletButton';
import { ReRailLogo } from '@/components/ReRailLogo';
import { NetworkBadge } from '@/components/NetworkBadge';
import { toast } from '@/stores/toast.store';

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = useAuthStore((state) => state.signOut);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'New Payout', path: '/campaigns/new', icon: PlusCircle },
    { label: 'Docs', path: '/docs', icon: BookOpen },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    toast.info('Signed out');
    navigate('/');
  };

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 hidden md:flex flex-col justify-between p-4 bg-[#080808] border-r border-white/10">
      <div>
        {/* Logo & Network */}
        <div className="flex items-center justify-between mb-6 px-1">
          <Link to="/" className="flex items-center gap-2.5 text-white font-medium text-lg">
            <ReRailLogo size={24} strokeWidth={1.5} />
            <span>ReRail</span>
          </Link>
          <NetworkBadge compact />
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} strokeWidth={1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-1 pt-4 border-t border-white/10">
        <WalletButton variant="glass" compact className="w-full justify-center" />
        <Link
          to="/"
          className="flex items-center gap-3 px-4 py-2 text-xs text-white/40 hover:text-white transition-colors"
        >
          <Home size={16} strokeWidth={1.5} />
          <span>Landing Page</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-2 text-xs text-white/40 hover:text-white transition-colors text-left"
        >
          <LogOut size={16} strokeWidth={1.5} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

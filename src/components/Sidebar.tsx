import { Link, useLocation } from 'react-router-dom';
import {
  Infinity as InfinityIcon,
  LayoutDashboard,
  PlusCircle,
  Users,
  Settings,
  Gift,
  Home,
  LogOut,
} from 'lucide-react';

export function Sidebar() {
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'New Payout', path: '/payouts/new', icon: PlusCircle },
    { label: 'Recipients', path: '/dashboard', icon: Users },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 hidden md:flex flex-col justify-between p-4 bg-[#0a0a0a] border-r border-white/10">
      <div>
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 px-3 py-3 text-white font-medium text-lg mb-6">
          <InfinityIcon size={24} strokeWidth={1.5} />
          <span>ReRail</span>
        </Link>

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

      {/* Footer / Demo links */}
      <div className="flex flex-col gap-1 pt-4 border-t border-white/10">
        <Link
          to="/claim/demo"
          className="flex items-center gap-3 px-4 py-2 text-xs text-white/40 hover:text-white transition-colors"
        >
          <Gift size={16} strokeWidth={1.5} />
          <span>View Claim Page Demo</span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-3 px-4 py-2 text-xs text-white/40 hover:text-white transition-colors"
        >
          <Home size={16} strokeWidth={1.5} />
          <span>Landing Page</span>
        </Link>
        <Link
          to="/login"
          className="flex items-center gap-3 px-4 py-2 text-xs text-white/40 hover:text-white transition-colors"
        >
          <LogOut size={16} strokeWidth={1.5} />
          <span>Log out</span>
        </Link>
      </div>
    </aside>
  );
}

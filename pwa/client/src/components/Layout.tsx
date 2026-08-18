import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Timer, CalendarDays, CheckSquare, BarChart3,
  Calendar, Tags, Settings, Menu, X, LogOut,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useTimerStore } from '../stores/timerStore';
import { formatTimerDisplay } from '../lib/utils';
import InstallPrompt from './InstallPrompt';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tracker', icon: Timer, label: 'Time Tracker' },
  { to: '/schedule', icon: CalendarDays, label: 'Daily Schedule' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/activities', icon: Tags, label: 'Activities' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const { user, logout } = useAuthStore();
  const { timer, elapsedMs } = useTimerStore();
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const sidebar = (
    <aside className="flex flex-col h-full">
      <div className="p-5 border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-lg">⏱️</span>
          </div>
          <div>
            <h1 className="font-display font-semibold text-sm">Time Tracker</h1>
            <p className="text-xs text-muted">Premium Edition</p>
          </div>
        </div>
      </div>

      {timer && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-productive/10 border border-productive/20">
          <p className="text-xs text-productive font-medium mb-1">Timer Running</p>
          <p className="text-sm font-semibold truncate">{timer.emoji} {timer.activity_name}</p>
          <p className="text-lg font-display font-bold text-productive">{formatTimerDisplay(elapsedMs)}</p>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
          >
            <Icon className="w-[18px] h-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border dark:border-border-dark">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={logout} className="btn-ghost w-full text-sm text-muted">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-background dark:bg-background-dark">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 shrink-0 border-r border-border dark:border-border-dark bg-white dark:bg-surface-dark">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-surface-dark shadow-elevated animate-slide-up">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-surface-dark/80 backdrop-blur border-b border-border dark:border-border-dark">
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-2">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-display font-semibold text-sm flex-1">Time Tracker</h1>
          {timer && (
            <span className="text-xs font-mono text-productive font-semibold">
              {formatTimerDisplay(elapsedMs)}
            </span>
          )}
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto pb-24 lg:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-surface-dark border-t border-border dark:border-border-dark safe-area-bottom">
          <div className="flex justify-around py-2">
            {navItems.slice(0, 5).map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-muted'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {label.split(' ')[0]}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      <InstallPrompt />
    </div>
  );
}

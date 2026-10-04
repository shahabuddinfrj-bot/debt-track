import React, { useState } from 'react';
import {
  Bell,
  Moon,
  Sun,
  Plus,
  Database,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Menu,
  X,
  LayoutDashboard,
  Wallet,
  Calendar,
  AlertCircle,
  BarChart3,
  History,
  Settings,
  MessageSquare,
  User,
  ShieldAlert,
  PiggyBank,
} from 'lucide-react';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface NavbarProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onOpenAddLoan: () => void;
  onNavigate: (view: string) => void;
  activeView: string;
  refreshTrigger: number;
  onRefreshAll?: () => void;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  onUpdateSettings,
  onOpenAddLoan,
  onNavigate,
  activeView,
  refreshTrigger,
  onRefreshAll,
  onOpenAuthModal,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const currentUser = storageService.getCurrentUser();

  const handleManualSync = async () => {
    setIsSyncing(true);
    await storageService.pullFromServer();
    await storageService.pushToServer();
    onRefreshAll?.();
    setTimeout(() => setIsSyncing(false), 500);
  };

  // Compute live notifications
  const metrics = storageService.getDashboardMetrics();
  const loans = storageService.getLoans(false);

  const notifications: {
    id: string;
    type: 'overdue' | 'upcoming' | 'info';
    title: string;
    desc: string;
    actionView?: string;
  }[] = [];

  if (metrics.overdueCount > 0) {
    notifications.push({
      id: 'notif_overdue',
      type: 'overdue',
      title: `${metrics.overdueCount} Overdue EMI${metrics.overdueCount > 1 ? 's' : ''}`,
      desc: `Total overdue: ${formatCurrency(metrics.overdueAmount, settings.currencySymbol, settings.currency)}`,
      actionView: 'overdue',
    });
  }

  if (metrics.nextEmiDue) {
    notifications.push({
      id: 'notif_upcoming',
      type: 'upcoming',
      title: `Upcoming EMI: ${metrics.nextEmiDue.loanName}`,
      desc: `${formatCurrency(metrics.nextEmiDue.amount, settings.currencySymbol, settings.currency)} due on ${formatDate(metrics.nextEmiDue.dueDate, settings.dateFormat)} (${metrics.nextEmiDue.daysRemaining === 0 ? 'Today' : `in ${metrics.nextEmiDue.daysRemaining} days`})`,
      actionView: 'upcoming',
    });
  }

  if (metrics.emisDueThisMonth > 0) {
    notifications.push({
      id: 'notif_month',
      type: 'info',
      title: 'Current Month Commitment',
      desc: `${metrics.emisDueThisMonth} installments scheduled for this month`,
      actionView: 'monthly',
    });
  }

  const toggleDarkMode = () => {
    const updated = { ...settings, isDarkMode: !settings.isDarkMode };
    if (updated.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    onUpdateSettings(updated);
  };

  return (
    <>
      <header className="sticky top-0 pt-9 z-40 w-full max-w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <div className="w-full max-w-full overflow-hidden px-3 py-2 flex items-center justify-between max-w-7xl mx-auto min-h-[52px] sm:min-h-[64px]">
          {/* Zone 1: Single element Brand wordmark with Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 font-bold text-xs sm:text-sm tracking-wider shadow-sm shrink-0">
                DT
              </div>
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                DebtTrack
              </span>
            </button>
            <span className="hidden sm:inline-block text-xs font-mono text-slate-600 dark:text-slate-300 ml-1">
              v1.0
            </span>
          </div>

        {/* Zone 2: Navigation Links (single line, unboxed) */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`transition-colors hover:text-slate-900 dark:hover:text-white ${
              activeView === 'dashboard' ? 'text-slate-900 dark:text-white font-semibold' : ''
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('loans')}
            className={`transition-colors hover:text-slate-900 dark:hover:text-white ${
              activeView === 'loans' ? 'text-slate-900 dark:text-white font-semibold' : ''
            }`}
          >
            My Loans
          </button>
          <button
            onClick={() => onNavigate('upcoming')}
            className={`transition-colors hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 ${
              activeView === 'upcoming' ? 'text-slate-900 dark:text-white font-semibold' : ''
            }`}
          >
            Upcoming
            {metrics.nextEmiDue && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            )}
          </button>
          <button
            onClick={() => onNavigate('calendar')}
            className={`transition-colors hover:text-slate-900 dark:hover:text-white ${
              activeView === 'calendar' ? 'text-slate-900 dark:text-white font-semibold' : ''
            }`}
          >
            EMI Calendar
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className={`transition-colors hover:text-slate-900 dark:hover:text-white ${
              activeView === 'reports' ? 'text-slate-900 dark:text-white font-semibold' : ''
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className={`transition-colors hover:text-slate-900 dark:hover:text-white ${
              activeView === 'settings' ? 'text-slate-900 dark:text-white font-semibold' : ''
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Zone 3: Actions (Compact, responsive, zero overflow) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Notifications dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative shrink-0"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {(metrics.overdueCount > 0 || notifications.length > 0) && (
                <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 rounded-full bg-rose-500" />
              )}
            </button>

            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 sm:bg-transparent"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="fixed right-3 top-14 sm:top-16 sm:right-4 w-[calc(100vw-24px)] max-w-xs sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 text-sm z-50 animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                      Alerts & Reminders
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                      Ref: {formatDate(CURRENT_DATE_STR, settings.dateFormat)}
                    </span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-600 dark:text-slate-300 py-4 text-center">
                      All clear! No overdue or upcoming alerts.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (n.actionView) onNavigate(n.actionView);
                            setShowNotifications(false);
                          }}
                          className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {n.type === 'overdue' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            ) : n.type === 'upcoming' ? (
                              <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {n.title}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {n.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Cloud Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative shrink-0"
            title="Sync loans between Web and Studio"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-500' : ''}`} />
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Toggle theme"
          >
            {settings.isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Account & Multi-User button */}
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 text-xs font-medium border border-slate-200/60 dark:border-slate-800 cursor-pointer"
              title="Sign In / Switch User"
            >
              <div className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center font-bold text-[10px]">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
              </div>
              <span className="hidden md:inline max-w-[85px] truncate text-[11px]">
                {currentUser?.name ? currentUser.name.split(' ')[0] : 'Sign In'}
              </span>
            </button>
          )}

          {/* Primary Action Button */}
          <button
            onClick={onOpenAddLoan}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-medium sm:font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Loan</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>
    </header>

    {/* Mobile Hamburger Drawer (Slide in from left) */}
    {isMobileDrawerOpen && (
      <div className="lg:hidden fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsMobileDrawerOpen(false)}
        />

        {/* Drawer Panel */}
        <div className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full shadow-2xl z-10 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800 animate-in slide-in-from-left duration-250 ease-out">
          <div>
            {/* Header: "DebtTrack" brand aur Close button */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 font-bold text-sm tracking-wider shadow-xs">
                  DT
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                    DebtTrack
                  </h2>
                  <p className="text-[10px] text-slate-500 font-mono">Loan & EMI Manager</p>
                </div>
              </div>

              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav Links with icons */}
            <div className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-160px)]">
              {[
                { id: 'dashboard', label: 'Dashboard / Home', icon: LayoutDashboard },
                { id: 'loans', label: 'Loans', icon: Wallet, count: metrics.activeLoansCount },
                { id: 'deposits', label: 'Deposits & Savings', icon: PiggyBank },
                { id: 'upcoming', label: 'Upcoming EMIs', icon: Clock },
                { id: 'calendar', label: 'EMI Calendar', icon: Calendar },
                {
                  id: 'overdue',
                  label: 'Overdue Tracker',
                  icon: AlertCircle,
                  alertCount: metrics.overdueCount,
                },
                { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
                { id: 'audit', label: 'Audit Log', icon: History },
                { id: 'profile', label: 'User Profile', icon: User },
                ...(storageService.isMasterAdmin()
                  ? [{ id: 'admin', label: 'Admin Panel', icon: ShieldAlert }]
                  : []),
                { id: 'settings', label: 'Backup & Settings', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? '' : 'text-slate-500 dark:text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.alertCount !== undefined && item.alertCount > 0 ? (
                      <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-mono font-bold rounded-full">
                        {item.alertCount}
                      </span>
                    ) : item.count !== undefined && item.count > 0 ? (
                      <span
                        className={`text-[11px] font-mono ${
                          isActive ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {/* WhatsApp Support Link */}
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                <a
                  href="https://wa.me/919042233122?text=Hello%20DebtTrack%20Support"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp Support</span>
                </a>
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>DebtTrack App</span>
              <span className="font-mono">v1.0</span>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

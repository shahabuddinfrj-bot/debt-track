import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  Clock,
  Calendar,
  AlertCircle,
  BarChart3,
  CalendarRange,
  History,
  Settings,
  Database,
  User,
  ShieldAlert,
  PiggyBank,
} from 'lucide-react';
import { storageService } from '../../services/storage';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  refreshTrigger: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
}) => {
  const metrics = storageService.getDashboardMetrics();
  const isMasterAdmin = storageService.isMasterAdmin();
  const activeDeposits = storageService.getDeposits(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'loans', label: 'My Loans', icon: Wallet, count: metrics.activeLoansCount },
    { id: 'deposits', label: 'Deposits & Savings', icon: PiggyBank, count: activeDeposits.length > 0 ? activeDeposits.length : undefined },
    { id: 'upcoming', label: 'Upcoming EMIs', icon: Clock },
    { id: 'calendar', label: 'EMI Calendar', icon: Calendar },
    {
      id: 'overdue',
      label: 'Overdue Tracker',
      icon: AlertCircle,
      alertCount: metrics.overdueCount,
    },
    { id: 'monthly', label: 'Monthly Ledger', icon: CalendarRange },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'audit', label: 'Audit Log', icon: History },
    { id: 'profile', label: 'User Profile', icon: User },
    ...(isMasterAdmin
      ? [{ id: 'admin', label: 'Admin Panel', icon: ShieldAlert, isAdmin: true }]
      : []),
    { id: 'settings', label: 'Backup & Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar (Left side, 240px) */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 min-h-[calc(100vh-4rem)] p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? '' : 'text-slate-500 dark:text-slate-300'}`} />
                  <span className="truncate">{item.label}</span>
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
        </div>

        {/* Bottom Storage & Health indicator */}
        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="font-medium text-[11px]">Storage Mode</span>
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                Authoritative Local
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              {metrics.totalLoans} loan records synced.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (< lg screens) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-md px-2 py-1.5">
        <div className="flex items-center justify-around">
          {[
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'loans', label: 'Loans', icon: Wallet },
            { id: 'upcoming', label: 'Upcoming', icon: Clock },
            { id: 'calendar', label: 'Calendar', icon: Calendar },
            { id: 'reports', label: 'Reports', icon: BarChart3 },
            { id: 'settings', label: 'More', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors text-[10px] ${
                  isActive
                    ? 'text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

import React, { useState } from 'react';
import {
  ShieldAlert,
  Users,
  Search,
  Eye,
  CheckCircle2,
  Calendar,
  Wallet,
  Sparkles,
  FileText,
  UserCheck,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { storageService, MASTER_USER } from '../../services/storage';
import { AuthUser } from '../../types/loan';
import { formatDate } from '../../utils/formatters';

interface AdminPanelViewProps {
  onInspectUser: (user: AuthUser) => void;
  onNavigate: (view: string) => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  onInspectUser,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const users = storageService.getUsers();
  const allLoansCount = users.reduce(
    (total, user) => total + storageService.getUserLoansCount(user.id),
    0
  );

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Banner Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Master Admin Dashboard
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Shield className="w-3 h-3" />
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-User Management & User Troubleshooting Mode (शाहबुद्दीन)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Back to My Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs uppercase tracking-wider font-medium">Registered Accounts</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {users.length}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Isolated client data environments
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs uppercase tracking-wider font-medium">Total System Loans</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {allLoansCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Across all customer accounts
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs uppercase tracking-wider font-medium">Master Account</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {MASTER_USER.name}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono truncate">
            {MASTER_USER.email}
          </p>
        </div>
      </div>

      {/* Users Management Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Search & Header Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>All Registered Users</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {filteredUsers.length}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Inspect user loans and schedules in read-only debug mode
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by name or email..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Users Table (Desktop) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-center">Total Loans</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No registered users match your search query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isMaster = user.email.toLowerCase() === MASTER_USER.email.toLowerCase();
                  const loanCount = storageService.getUserLoansCount(user.id);
                  const regDate = user.createdAt ? formatDate(user.createdAt.split('T')[0]) : 'Initial';

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                              isMaster
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {user.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {user.id.substring(0, 14)}...
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {user.email}
                      </td>
                      <td className="py-3 px-4">
                        {isMaster ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Sparkles className="w-3 h-3" />
                            Master Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Client User
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        {regDate}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                            loanCount > 0
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {loanCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onInspectUser(user)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
                          title={`Inspect ${user.name}'s loan portfolio`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect / View As User</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Users Cards (Mobile) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No registered users match your search query.
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isMaster = user.email.toLowerCase() === MASTER_USER.email.toLowerCase();
              const loanCount = storageService.getUserLoansCount(user.id);
              const regDate = user.createdAt ? formatDate(user.createdAt.split('T')[0]) : 'Initial';

              return (
                <div key={user.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          isMaster
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-slate-900 dark:text-white block">
                          {user.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block">
                          {user.email}
                        </span>
                      </div>
                    </div>

                    {isMaster ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Admin
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Client
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>Registered: {regDate}</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white">
                      {loanCount} Loans
                    </span>
                  </div>

                  <button
                    onClick={() => onInspectUser(user)}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect / View As User</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

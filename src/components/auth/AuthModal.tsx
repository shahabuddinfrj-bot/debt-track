import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  LogOut,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { storageService } from '../../services/storage';
import { AuthUser } from '../../types/loan';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onAuthSuccess: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'REGISTER') {
      const res = storageService.registerUser(name, email, password);
      if (!res.success) {
        setError(res.error || 'Failed to create account');
        return;
      }
      setSuccessMsg(`Welcome, ${res.user!.name}! Your private account has been created.`);
      setTimeout(() => {
        onAuthSuccess(res.user!);
        onClose();
      }, 700);
    } else {
      const res = storageService.loginUser(email, password);
      if (!res.success) {
        setError(res.error || 'Invalid credentials');
        return;
      }
      setSuccessMsg(`Welcome back, ${res.user!.name}!`);
      setTimeout(() => {
        onAuthSuccess(res.user!);
        onClose();
      }, 700);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-900 dark:text-white animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {mode === 'LOGIN' ? 'Sign In to Account' : 'Create New Account'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Multi-User Access & Strictly Isolated Loan Data
              </p>
            </div>
          </div>
          {/* Only allow closing if already authenticated */}
          {currentUser && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Current Active Account Indicator (Only if logged in) */}
        {currentUser ? (
          <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Logged In As
                </span>
                <span className="font-semibold text-slate-900 dark:text-white block truncate">
                  {currentUser.name}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
                  {currentUser.email}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                storageService.logoutUser();
                onAuthSuccess(null as any);
              }}
              className="px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300">
            <p className="font-medium">
              Please sign in with your credentials or create a new account to manage your loans.
            </p>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setError('');
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'LOGIN'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setError('');
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'REGISTER'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Register / Sign Up
          </button>
        </div>

        {/* Feedback Message */}
        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form (Strict email & password required) */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'REGISTER' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{mode === 'LOGIN' ? 'Sign In to My Loans' : 'Create Isolated Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-500 dark:text-slate-400">
          Strict Data Isolation &bull; End-to-End Privacy Protected
        </div>
      </div>
    </div>
  );
};

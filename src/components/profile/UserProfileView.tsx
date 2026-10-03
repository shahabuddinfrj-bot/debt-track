import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Unlock,
  CheckCircle2,
  Calendar,
  Wallet,
  TrendingUp,
  CreditCard,
  Download,
  Share2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { UserSettings } from '../../types/loan';
import { storageService } from '../../services/storage';
import { formatCurrency } from '../../utils/formatters';
import { ChangePinModal } from '../security/ChangePinModal';

interface UserProfileViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onNavigate: (view: string) => void;
  onLockApp: () => void;
  onOpenAuthModal?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  settings,
  onUpdateSettings,
  onNavigate,
  onLockApp,
  onOpenAuthModal,
}) => {
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const currentUser = storageService.getCurrentUser();
  const profile = storageService.getUserProfile();
  const metrics = storageService.getDashboardMetrics();
  const currentPin = settings.securityPin || storageService.getSecurityPin();
  const isLockActive = settings.isAppLockEnabled && !!currentPin;

  const handleToggleLock = () => {
    if (!currentPin) {
      // If no PIN set, open modal to set one first
      setIsPinModalOpen(true);
      return;
    }
    const nextState = !settings.isAppLockEnabled;
    storageService.toggleAppLock(nextState);
    const updated = {
      ...settings,
      isAppLockEnabled: nextState,
    };
    onUpdateSettings(updated);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full max-w-full">
      {/* Top Header Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-700 dark:from-slate-100 dark:to-slate-300 text-white dark:text-slate-900 flex items-center justify-center font-bold text-2xl shadow-md shrink-0">
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {profile.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified Borrower
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Account Holder & Primary Borrower Profile
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
              >
                <User className="w-3.5 h-3.5" />
                <span>Switch / Sign In</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('reports')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Statement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Portfolio Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs uppercase tracking-wider font-medium">Active Loans</span>
            <Wallet className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {metrics.activeLoansCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Total {metrics.totalLoans} loan records in account
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs uppercase tracking-wider font-medium">Total Borrowed</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(metrics.totalPrincipalBorrowed, settings.currencySymbol, settings.currency)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Total principal sanctioned across loans
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs uppercase tracking-wider font-medium">Total Repaid</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatCurrency(metrics.totalPrincipalRepaid, settings.currencySymbol, settings.currency)}
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `${metrics.overallRepaymentProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Personal & Contact Details Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Personal & Contact Information
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Information referenced across statements, legal reports, and repayment receipts
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Full Name */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 shadow-xs shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
                  Full Name
                </span>
                <p className="font-semibold text-slate-900 dark:text-white text-sm mt-0.5">
                  {profile.name}
                </p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(profile.name, 'name')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Copy Name"
            >
              {copiedField === 'name' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Mobile Number */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 shadow-xs shrink-0">
                <Phone className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
                  Primary Mobile
                </span>
                <p className="font-mono font-semibold text-slate-900 dark:text-white text-sm mt-0.5">
                  +91 {profile.mobile}
                </p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(profile.mobile, 'mobile')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Copy Mobile"
            >
              {copiedField === 'mobile' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Email */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 shadow-xs shrink-0">
                <Mail className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
                  Email Address
                </span>
                <p className="font-mono font-semibold text-slate-900 dark:text-white text-sm mt-0.5 break-all">
                  {profile.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(profile.email, 'email')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Copy Email"
            >
              {copiedField === 'email' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Residential Address */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between md:col-span-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 shadow-xs shrink-0">
                <MapPin className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
                  Permanent / Residential Address
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200 text-xs mt-0.5 leading-relaxed">
                  {profile.address}
                </p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(profile.address, 'address')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Copy Address"
            >
              {copiedField === 'address' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Security & App Lock Settings Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Shield className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                App Lock & Security Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                4-Digit PIN protection and automatic privacy lock
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
              isLockActive
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {isLockActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span>{isLockActive ? 'Active' : 'Inactive'}</span>
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {/* Toggle App Lock */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                Enable App Lock Protection
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Requires 4-digit PIN whenever application opens or restarts
              </p>
            </div>
            <button
              onClick={handleToggleLock}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                isLockActive ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
            </button>
          </div>

          {/* Change PIN & Lock Now Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <button
              onClick={() => setIsPinModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-500" />
              <span>{currentPin ? 'Change Security PIN' : 'Set 4-Digit PIN'}</span>
            </button>

            {isLockActive && (
              <button
                onClick={onLockApp}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock App Now</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Change PIN Modal */}
      <ChangePinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />
    </div>
  );
};

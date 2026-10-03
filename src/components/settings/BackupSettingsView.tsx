import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  Moon,
  Sun,
  ShieldAlert,
  Trash2,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  User,
  Shield,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface BackupSettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onLoadDemoData: () => void;
  onClearDemoData: () => void;
  onRefreshAll: () => void;
  onNavigate?: (view: string) => void;
}

export const BackupSettingsView: React.FC<BackupSettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onLoadDemoData,
  onClearDemoData,
  onRefreshAll,
  onNavigate,
}) => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profile = storageService.getUserProfile();
  const currentPin = settings.securityPin || storageService.getSecurityPin();
  const isLockActive = settings.isAppLockEnabled && !!currentPin;

  const loans = storageService.getLoans(true);
  const activeLoans = loans.filter((l) => !l.isArchived);
  const demoLoans = loans.filter((l) => l.isDemo);
  const docs = storageService.getDocuments();
  const auditLogs = storageService.getAuditLogs();

  const handleCurrencyChange = (curr: string, sym: string) => {
    const updated: UserSettings = {
      ...settings,
      currency: curr,
      currencySymbol: sym,
    };
    onUpdateSettings(updated);
    storageService.saveSettings(updated);
    showNotice(`Currency updated to ${curr} (${sym})`);
  };

  const handleDateFormatChange = (fmt: UserSettings['dateFormat']) => {
    const updated: UserSettings = {
      ...settings,
      dateFormat: fmt,
    };
    onUpdateSettings(updated);
    storageService.saveSettings(updated);
    showNotice(`Date format updated to ${fmt}`);
  };

  const showNotice = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleDownloadBackup = () => {
    const jsonStr = storageService.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DebtTrack_Backup_${CURRENT_DATE_STR}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('Backup downloaded successfully.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!confirm('Restoring this backup will replace current records. Do you wish to continue?')) {
          return;
        }

        const res = storageService.restoreBackup(content);
        if (res.success) {
          showNotice('Backup restored successfully!');
          onRefreshAll();
        } else {
          alert(res.error || 'Failed to restore backup.');
        }
      } catch (err: any) {
        alert('Could not read file: ' + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportLoansCSV = () => {
    const headers = [
      'ID',
      'Name',
      'Lender',
      'Loan Type',
      'Account Number',
      'Original Amount',
      'Outstanding Principal',
      'Interest Rate',
      'Interest Type',
      'Tenure Months',
      'Monthly EMI',
      'EMIs Paid',
      'EMIs Remaining',
      'Next EMI Date',
      'Status',
    ];

    const rows = activeLoans.map((l) => [
      l.id,
      `"${l.name}"`,
      `"${l.lender}"`,
      l.loanType,
      l.accountNumber || '',
      l.originalAmount,
      l.outstandingPrincipal,
      l.interestRate,
      l.interestType,
      l.tenureMonths,
      l.emiAmount,
      l.emisPaid,
      l.emisRemaining,
      l.nextEmiDate || '',
      l.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `DebtTrack_Loans_${CURRENT_DATE_STR}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotice('Loans CSV exported.');
  };

  const handleClearAll = () => {
    const promptText = window.prompt(
      'Type "DELETE ALL" to permanently erase all local loans, schedules, and payment records:'
    );
    if (promptText === 'DELETE ALL') {
      storageService.clearAllData();
      onRefreshAll();
      showNotice('All data has been cleared.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Backup, Export & Settings
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
          Configure regional currency preferences, download verified JSON backups, and manage demo datasets.
        </p>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* User Profile & Security Overview */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-lg shrink-0">
              श
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {profile.name}
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Account Holder
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                +91 {profile.mobile} · {profile.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
                isLockActive
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {isLockActive ? <Lock className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
              <span>Lock: {isLockActive ? 'Active' : 'Inactive'}</span>
            </span>

            {onNavigate && (
              <button
                onClick={() => onNavigate('profile')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
              >
                <span>View Full Profile</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Regional & Financial Preferences */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Regional & Display Preferences
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Currency */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Active Currency
            </label>
            <select
              value={`${settings.currency}:${settings.currencySymbol}`}
              onChange={(e) => {
                const [curr, sym] = e.target.value.split(':');
                handleCurrencyChange(curr, sym);
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="INR:₹">INR (₹) - Indian Rupee (Default)</option>
              <option value="USD:$">USD ($) - US Dollar</option>
              <option value="EUR:€">EUR (€) - Euro</option>
              <option value="GBP:£">GBP (£) - British Pound</option>
              <option value="AED:AED">AED - UAE Dirham</option>
              <option value="CAD:$">CAD ($) - Canadian Dollar</option>
              <option value="AUD:$">AUD ($) - Australian Dollar</option>
              <option value="SGD:$">SGD ($) - Singapore Dollar</option>
            </select>
          </div>

          {/* Date format */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Date Format
            </label>
            <select
              value={settings.dateFormat}
              onChange={(e) => handleDateFormatChange(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 05/10/2026 - Standard)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/05/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-05 - ISO)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Backup & Restore Panel */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Data Safety, Backup & Restore
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Keep full offline backups of your loans, payment logs, and amortization schedules.
          </p>
        </div>

        {/* Current Database Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs font-mono">
          <div>
            <span className="text-slate-600 dark:text-slate-300 block text-[10px] uppercase">
              Total Loans
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {loans.length}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-300 block text-[10px] uppercase">
              Documents
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {docs.length}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-300 block text-[10px] uppercase">
              Audit Logs
            </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {auditLogs.length}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-300 block text-[10px] uppercase">
              Storage Engine
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
              LocalStorage
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
          <button
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Download JSON Backup</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Restore From JSON</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />

          <button
            onClick={handleExportLoansCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ml-auto"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Loans CSV</span>
          </button>
        </div>
      </div>

      {/* Demo Data Management */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Sample & Demo Data Management
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Demo data allows you to test reducing balance schedules, partial payments, prepayments, and
          overdue tracking without entering your real bank records.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          <button
            onClick={onLoadDemoData}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Load 5 Sample Loans (Home, Car, Personal, Gold, CC)
          </button>

          {demoLoans.length > 0 && (
            <button
              onClick={onClearDemoData}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-rose-600 dark:text-rose-400 font-medium rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              Clear Demo Data ({demoLoans.length} items)
            </button>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl space-y-3 text-xs">
        <div className="flex items-center gap-2 text-rose-900 dark:text-rose-300 font-semibold text-sm">
          <ShieldAlert className="w-4 h-4" />
          <span>Danger Zone: Erase Local Data</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300">
          Permanently delete all stored loans, schedules, attachments, and payment transaction logs from this browser.
        </p>
        <button
          onClick={handleClearAll}
          className="px-3.5 py-1.5 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition-colors shadow-xs"
        >
          Clear All Application Data
        </button>
      </div>
    </div>
  );
};

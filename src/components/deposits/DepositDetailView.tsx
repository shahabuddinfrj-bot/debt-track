import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit2,
  HelpCircle,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
  AlertCircle,
  Check,
  ChevronRight,
  ShieldCheck,
  Percent,
  FileText,
  Lock,
} from 'lucide-react';
import { Deposit, DepositScheduleItem, DepositTransaction } from '../../types/deposit';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { calculateDepositProgress } from '../../utils/depositCalculations';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface DepositDetailViewProps {
  depositId: string;
  settings: UserSettings;
  onBack: () => void;
  onEditDeposit: (deposit: Deposit) => void;
  onRecordContribution: (depositId: string, installmentNo?: number) => void;
  refreshTrigger?: number;
}

export const DepositDetailView: React.FC<DepositDetailViewProps> = ({
  depositId,
  settings,
  onBack,
  onEditDeposit,
  onRecordContribution,
}) => {
  const deposit = storageService.getDeposit(depositId);
  const schedule = storageService.getDepositSchedule(depositId);
  const transactions = storageService.getDepositTransactions(depositId);

  const [activeTab, setActiveTab] = useState<'schedule' | 'transactions'>('schedule');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmMature, setConfirmMature] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  if (!deposit) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <p className="text-slate-600 dark:text-slate-400 mb-4">Deposit account not found.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-xs font-semibold"
        >
          Back to Deposits
        </button>
      </div>
    );
  }

  const metrics = calculateDepositProgress(deposit, schedule, transactions, CURRENT_DATE_STR);

  const handleDelete = () => {
    storageService.deleteDeposit(depositId);
    onBack();
  };

  const handleMature = () => {
    storageService.matureDeposit(depositId);
    setConfirmMature(false);
  };

  const handleClose = () => {
    storageService.closeDeposit(depositId);
    setConfirmClose(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 uppercase tracking-wider">
                {deposit.type}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                  deposit.status === 'ACTIVE'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    : deposit.status === 'MATURED'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {deposit.status}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {deposit.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {deposit.status === 'ACTIVE' && (
            <button
              onClick={() => onRecordContribution(deposit.id)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Contribution</span>
            </button>
          )}

          <button
            onClick={() => onEditDeposit(deposit)}
            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {deposit.status === 'ACTIVE' && (
            <button
              onClick={() => setConfirmMature(true)}
              className="px-3 py-2 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            >
              Mature
            </button>
          )}

          {deposit.status !== 'CLOSED' && (
            <button
              onClick={() => setConfirmClose(true)}
              className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Close
            </button>
          )}

          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
            title="Delete Deposit"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirmation Modals */}
      {confirmDelete && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Are you sure you want to permanently delete this deposit account and all associated records?</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}

      {confirmMature && (
        <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-purple-900 dark:text-purple-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Mark this deposit as Matured? This indicates all installments or tenure terms are completed.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setConfirmMature(false)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={handleMature}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold"
            >
              Mark Matured
            </button>
          </div>
        </div>
      )}

      {confirmClose && (
        <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-900 dark:text-slate-200">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
            <span>Close this deposit account? Closed accounts stop active installment notifications.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setConfirmClose(false)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white rounded-lg font-bold"
            >
              Confirm Close
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Balance */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Accumulated Balance</span>
            <PiggyBank className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(metrics.currentBalance, settings.currencySymbol, settings.currency)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Target / Maturity:{' '}
            <span className="font-mono font-semibold">
              {formatCurrency(metrics.targetOrMaturityAmount, settings.currencySymbol, settings.currency)}
            </span>
          </div>
        </div>

        {/* Total Contributions */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">
              {deposit.type === 'RD' ? 'Monthly Installment' : 'Principal Deposited'}
            </span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {deposit.type === 'RD' && deposit.monthlyContribution
              ? formatCurrency(deposit.monthlyContribution, settings.currencySymbol, settings.currency)
              : formatCurrency(deposit.principalAmount, settings.currencySymbol, settings.currency)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {deposit.type === 'RD' ? `${metrics.installmentsCompleted} / ${schedule.length || deposit.totalInstallments || 0} Paid` : 'Lump Sum'}
          </div>
        </div>

        {/* Interest Rate & Accrued */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Interest Rate</span>
            <Percent className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {deposit.interestRate !== undefined ? `${deposit.interestRate}% p.a.` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {deposit.interestType === 'COMPOUND_QUARTERLY'
              ? 'Quarterly Compound'
              : deposit.interestType === 'COMPOUND_MONTHLY'
              ? 'Monthly Compound'
              : deposit.interestType || 'Simple Interest'}
          </div>
        </div>

        {/* Maturity & Progress */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Goal Progress</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {metrics.progressPercentage.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.progressPercentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metadata Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-400 block text-[11px]">Institution</span>
          <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            {deposit.institutionName || 'Self Managed'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Account / Folio #</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5 block">
            {deposit.accountNumber || '—'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Start Date</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {formatDate(deposit.startDate, settings.dateFormat)}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[11px]">Maturity / Target Date</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {deposit.maturityDate ? formatDate(deposit.maturityDate, settings.dateFormat) : 'Flexible'}
          </span>
        </div>
      </div>

      {/* Tabs for Schedule vs Transactions */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
        {deposit.type === 'RD' && (
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'schedule'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Installment Schedule ({schedule.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'transactions' || deposit.type !== 'RD'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Transaction Ledger ({transactions.length})</span>
        </button>
      </div>

      {/* Tab Content: RD Installment Schedule */}
      {deposit.type === 'RD' && activeTab === 'schedule' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Expected Contribution</th>
                  <th className="py-3 px-4">Paid Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {schedule.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      #{item.installmentNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {formatDate(item.dueDate, settings.dateFormat)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(item.expectedAmount, settings.currencySymbol, settings.currency)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.paidAmount, settings.currencySymbol, settings.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : item.status === 'PARTIAL'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : item.status === 'MISSED'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {item.paidDate ? formatDate(item.paidDate, settings.dateFormat) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.status !== 'PAID' && deposit.status === 'ACTIVE' && (
                        <button
                          onClick={() => onRecordContribution(deposit.id, item.installmentNumber)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
                        >
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Transaction Ledger */}
      {(activeTab === 'transactions' || deposit.type !== 'RD') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              <PiggyBank className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <span>No transactions recorded yet for this deposit account.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Reference / UTR</th>
                    <th className="py-3 px-4">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {formatDate(tx.transactionDate, settings.dateFormat)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.transactionType === 'CONTRIBUTION'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : tx.transactionType === 'INTEREST'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              : tx.transactionType === 'WITHDRAWAL'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {tx.transactionType === 'WITHDRAWAL' ? '-' : '+'}
                        {formatCurrency(tx.amount, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                        {tx.referenceNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {tx.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

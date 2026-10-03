import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  PiggyBank,
  Building,
  Calendar,
  Clock,
  ChevronRight,
  TrendingUp,
  Percent,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  Edit2,
} from 'lucide-react';
import { Deposit, DepositStatus, DepositType } from '../../types/deposit';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calculateDepositProgress } from '../../utils/depositCalculations';

interface DepositsListViewProps {
  settings: UserSettings;
  onOpenAddDeposit: () => void;
  onSelectDeposit: (depositId: string) => void;
  onEditDeposit: (deposit: Deposit) => void;
  onRecordContribution: (depositId: string) => void;
  refreshTrigger?: number;
}

export const DepositsListView: React.FC<DepositsListViewProps> = ({
  settings,
  onOpenAddDeposit,
  onSelectDeposit,
  onEditDeposit,
  onRecordContribution,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | DepositType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DepositStatus>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const allDeposits = storageService.getDeposits(true);

  // Filtered deposits
  const filteredDeposits = useMemo(() => {
    return allDeposits.filter((d) => {
      // Type filter
      if (typeFilter !== 'ALL' && d.type !== typeFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && d.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = d.name.toLowerCase().includes(query);
        const matchesInstitution = d.institutionName?.toLowerCase().includes(query);
        const matchesAccount = d.accountNumber?.toLowerCase().includes(query);
        return matchesName || matchesInstitution || matchesAccount;
      }
      return true;
    });
  }, [allDeposits, typeFilter, statusFilter, searchQuery]);

  // Aggregate Metrics
  const totalAccumulatedBalance = allDeposits.reduce(
    (sum, d) => sum + (d.currentBalance || d.principalAmount || 0),
    0
  );
  const activeDepositsCount = allDeposits.filter((d) => d.status === 'ACTIVE').length;
  const maturedDepositsCount = allDeposits.filter((d) => d.status === 'MATURED').length;
  const totalMonthlyCommitment = allDeposits
    .filter((d) => d.status === 'ACTIVE' && d.type === 'RD' && d.monthlyContribution)
    .reduce((sum, d) => sum + (d.monthlyContribution || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <PiggyBank className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Deposits & Savings Accounts</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track Recurring Deposits (RD), Fixed Deposits (FD), and Goal Funds
          </p>
        </div>

        <button
          onClick={onOpenAddDeposit}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Deposit / Savings</span>
        </button>
      </div>

      {/* Aggregate Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Total Accumulated Assets
          </span>
          <div className="text-lg sm:text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalAccumulatedBalance, settings.currencySymbol, settings.currency)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Across all accounts</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Monthly RD Outlay
          </span>
          <div className="text-lg sm:text-xl font-mono font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalMonthlyCommitment, settings.currencySymbol, settings.currency)}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Active recurring deposits</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Active Accounts
          </span>
          <div className="text-lg sm:text-xl font-mono font-bold text-blue-600 dark:text-blue-400">
            {activeDepositsCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Open & compounding</span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            Matured Accounts
          </span>
          <div className="text-lg sm:text-xl font-mono font-bold text-purple-600 dark:text-purple-400">
            {maturedDepositsCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Completed tenures</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deposits by name, bank, account #..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            Type:
          </span>
          {(['ALL', 'RD', 'FD', 'SAVINGS', 'SAVINGS_GOAL', 'OTHER'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t === 'ALL' ? 'All Types' : t}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

          <span className="text-[11px] font-semibold text-slate-400 mr-1">Status:</span>
          {(['ALL', 'ACTIVE', 'MATURED', 'CLOSED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredDeposits.length === 0 ? (
        <div className="py-16 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-4">
            <PiggyBank className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            {allDeposits.length === 0
              ? 'Add your first deposit or savings account'
              : 'No matching deposit accounts found'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            {allDeposits.length === 0
              ? 'Start tracking your Recurring Deposits (RD), Fixed Deposits (FD), and savings goals alongside your loans.'
              : 'Try clearing your search query or filters to see all deposit accounts.'}
          </p>
          {allDeposits.length === 0 && (
            <button
              onClick={onOpenAddDeposit}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Deposit</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDeposits.map((deposit) => {
            const schedule = storageService.getDepositSchedule(deposit.id);
            const transactions = storageService.getDepositTransactions(deposit.id);
            const metrics = calculateDepositProgress(deposit, schedule, transactions, CURRENT_DATE_STR);

            return (
              <div
                key={deposit.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
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
                      <h3
                        onClick={() => onSelectDeposit(deposit.id)}
                        className="text-sm font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                      >
                        {deposit.name}
                      </h3>
                      {deposit.institutionName && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3 text-slate-400" />
                          <span>{deposit.institutionName}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onSelectDeposit(deposit.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Financial Metrics */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Current Balance</span>
                      <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(metrics.currentBalance, settings.currencySymbol, settings.currency)}
                      </span>
                    </div>

                    {deposit.type === 'RD' && deposit.monthlyContribution && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Monthly Contribution</span>
                        <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(deposit.monthlyContribution, settings.currencySymbol, settings.currency)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Interest Rate</span>
                      <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                        {deposit.interestRate !== undefined ? `${deposit.interestRate}% p.a.` : '—'}
                      </span>
                    </div>

                    {deposit.maturityDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Maturity Date</span>
                        <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                          {formatDate(deposit.maturityDate, settings.dateFormat)}
                        </span>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>Progress</span>
                        <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                          {metrics.progressPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, metrics.progressPercentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEditDeposit(deposit)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-xs"
                      title="Edit Deposit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${deposit.name}?`)) {
                          storageService.deleteDeposit(deposit.id);
                          window.location.reload();
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors text-xs"
                      title="Delete Deposit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {deposit.status === 'ACTIVE' && (
                      <button
                        onClick={() => onRecordContribution(deposit.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
                      >
                        Credit
                      </button>
                    )}
                    <button
                      onClick={() => onSelectDeposit(deposit.id)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Deposit Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Current Balance</th>
                  <th className="py-3 px-4">Contribution / Principal</th>
                  <th className="py-3 px-4">Interest</th>
                  <th className="py-3 px-4">Maturity Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDeposits.map((deposit) => (
                  <tr
                    key={deposit.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      <button
                        onClick={() => onSelectDeposit(deposit.id)}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400 text-left font-bold"
                      >
                        {deposit.name}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {deposit.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {deposit.institutionName || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(deposit.currentBalance || deposit.principalAmount, settings.currencySymbol, settings.currency)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {deposit.monthlyContribution
                        ? `${formatCurrency(deposit.monthlyContribution, settings.currencySymbol, settings.currency)}/mo`
                        : formatCurrency(deposit.principalAmount, settings.currencySymbol, settings.currency)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {deposit.interestRate !== undefined ? `${deposit.interestRate}%` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {deposit.maturityDate ? formatDate(deposit.maturityDate, settings.dateFormat) : '—'}
                    </td>
                    <td className="py-3 px-4">
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
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {deposit.status === 'ACTIVE' && (
                          <button
                            onClick={() => onRecordContribution(deposit.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            Pay
                          </button>
                        )}
                        <button
                          onClick={() => onSelectDeposit(deposit.id)}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

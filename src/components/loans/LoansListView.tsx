import React, { useState, useMemo } from 'react';
import { Clock, CheckCircle2, AlertTriangle, Calendar, ChevronRight, PiggyBank, Wallet } from 'lucide-react';
import { UnifiedUpcomingItem, UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate, getDaysDifference, getRelativeDueDateText } from '../../utils/formatters';

interface UpcomingEMIsViewProps {
  settings?: UserSettings;
  onQuickPay: (loanId: string, emiPaymentNo?: number) => void;
  onSelectLoan: (loanId: string) => void;
  onSelectDeposit?: (depositId: string) => void;
}

export const UpcomingEMIsView: React.FC<UpcomingEMIsViewProps> = ({
  settings,
  onQuickPay,
  onSelectLoan,
  onSelectDeposit,
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'ALL' | 'TODAY' | 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'THIS_MONTH'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'LOAN_EMI' | 'DEPOSIT_CONTRIBUTION'>('ALL');

  // Fallback defaults for settings to prevent undefined crashes
  const currencySymbol = settings?.currencySymbol || '₹';
  const currency = settings?.currency || 'INR';
  const dateFormat = settings?.dateFormat || 'DD/MM/YYYY';

  // Gather unified upcoming commitments safely
  const rawList = useMemo(() => {
    try {
      const data = storageService?.getUnifiedUpcomingPayments?.();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Error fetching upcoming payments:', err);
      return [];
    }
  }, []);

  const currentYearMonth = (CURRENT_DATE_STR || new Date().toISOString().slice(0, 10)).substring(0, 7);

  const upcomingList = useMemo(() => {
    return rawList.filter((item) => {
      if (!item) return false;

      // Category filter
      if (categoryFilter === 'LOAN_EMI' && item.category !== 'LOAN_EMI') return false;
      if (categoryFilter === 'DEPOSIT_CONTRIBUTION' && item.category === 'LOAN_EMI') return false;

      // Period filter with safe fallback checks
      const diff = Number(item.daysRemaining ?? 0);
      const dueDate = item.dueDate || '';
      const itemYearMonth = dueDate.length >= 7 ? dueDate.substring(0, 7) : '';

      if (filterPeriod === 'TODAY' && diff !== 0) return false;
      if (filterPeriod === 'NEXT_7_DAYS' && (diff < 0 || diff > 7)) return false;
      if (filterPeriod === 'NEXT_30_DAYS' && (diff < 0 || diff > 30)) return false;
      if (filterPeriod === 'THIS_MONTH' && itemYearMonth !== currentYearMonth) return false;

      return true;
    });
  }, [rawList, categoryFilter, filterPeriod, currentYearMonth]);

  const totalUpcomingSum = upcomingList.reduce(
    (sum, item) => sum + (Number(item.remainingAmount) || Number(item.amount) || 0),
    0
  );

  const totalLoansSum = upcomingList
    .filter((i) => i.category === 'LOAN_EMI')
    .reduce((sum, item) => sum + (Number(item.remainingAmount) || Number(item.amount) || 0), 0);

  const totalDepositsSum = upcomingList
    .filter((i) => i.category !== 'LOAN_EMI')
    .reduce((sum, item) => sum + (Number(item.remainingAmount) || Number(item.amount) || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Upcoming Payments & Contributions
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Aggregated upcoming obligations: Loan EMIs (Debt Repayment) and Deposit Contributions (Savings)
          </p>
        </div>

        {/* Total Summary */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-right">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Due ({upcomingList.length})
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {formatCurrency(totalUpcomingSum, currencySymbol, currency)}
            </div>
            <div className="text-[10px] text-slate-500">
              Loan: {formatCurrency(totalLoansSum, currencySymbol, currency)} | Dep: {formatCurrency(totalDepositsSum, currencySymbol, currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bars */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        {/* Category Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Commitments' },
            { id: 'LOAN_EMI', label: 'Loan EMIs' },
            { id: 'DEPOSIT_CONTRIBUTION', label: 'Deposit Contributions' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                categoryFilter === cat.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Time Period Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'TODAY', label: 'Due Today' },
            { id: 'NEXT_7_DAYS', label: 'Next 7 Days' },
            { id: 'NEXT_30_DAYS', label: 'Next 30 Days' },
            { id: 'THIS_MONTH', label: 'This Month' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterPeriod(tab.id as any)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors whitespace-nowrap ${
                filterPeriod === tab.id
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified List */}
      {upcomingList.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No Upcoming Payments Found
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            You are fully up to date or no commitments match the selected range.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
          {upcomingList.map((item) => {
            let rel = { isOverdue: false, isToday: false, text: '' };
            try {
              if (item.dueDate) {
                rel = getRelativeDueDateText(item.dueDate, CURRENT_DATE_STR || new Date().toISOString().slice(0, 10));
              }
            } catch (e) {
              rel = { isOverdue: false, isToday: false, text: item.dueDate || '' };
            }

            const isLoan = item.category === 'LOAN_EMI';
            const itemAmount = Number(item.amount) || Number(item.remainingAmount) || 0;

            return (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isLoan
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                    }`}
                  >
                    {isLoan ? <Wallet className="w-4 h-4" /> : <PiggyBank className="w-4 h-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        onClick={() => {
                          if (isLoan) onSelectLoan(item.sourceId);
                          else onSelectDeposit?.(item.sourceId);
                        }}
                        className="font-bold text-sm text-slate-900 dark:text-white hover:underline cursor-pointer truncate"
                      >
                        {item.name || 'Untitled Payment'}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                          isLoan
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {isLoan ? `Loan EMI #${item.paymentNo || ''}` : `Contribution #${item.paymentNo || ''}`}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>{item.entityName || 'N/A'}</span>
                      <span>·</span>
                      <span>{item.itemType || 'N/A'}</span>
                      {item.accountNumber && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{item.accountNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                  <div className="text-left sm:text-right">
                    <div className="text-xs text-slate-500">
                      Due: <span className="font-mono">{item.dueDate ? formatDate(item.dueDate, dateFormat) : '—'}</span>
                    </div>
                    <div
                      className={`text-xs font-mono font-semibold ${
                        rel?.isOverdue
                          ? 'text-rose-600 dark:text-rose-400 font-bold'
                          : rel?.isToday
                          ? 'text-amber-600 dark:text-amber-400 font-bold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {rel?.text || ''}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">
                      {isLoan ? 'EMI Amount' : 'Contribution'}
                    </div>
                    <div className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(itemAmount, currencySymbol, currency)}
                    </div>
                  </div>

                  <div>
                    {isLoan ? (
                      <button
                        type="button"
                        onClick={() => onQuickPay(item.sourceId, item.paymentNo)}
                        className="px-3.5 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        Pay EMI
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectDeposit?.(item.sourceId)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                      >
                        Record
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UpcomingEMIsView;

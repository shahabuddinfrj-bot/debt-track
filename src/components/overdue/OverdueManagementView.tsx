import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate, getDaysDifference } from '../../utils/formatters';

interface OverdueManagementViewProps {
  settings: UserSettings;
  onQuickPay: (loanId: string, emiPaymentNo?: number) => void;
  onSelectLoan: (loanId: string) => void;
}

export const OverdueManagementView: React.FC<OverdueManagementViewProps> = ({
  settings,
  onQuickPay,
  onSelectLoan,
}) => {
  // Use centralized authoritative overdue summary
  const { overdueList, overdueAmount: totalOverdueAmount } = useMemo(
    () => storageService.getOverdueSummary(),
    []
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Overdue EMI Management
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
          Immediate action center for past-due installments to maintain a strong credit score.
        </p>
      </div>

      {/* Overdue Warning Banner */}
      {overdueList.length > 0 ? (
        <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Action Required: {overdueList.length} Missed Installment{overdueList.length > 1 ? 's' : ''} Detected
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-xl leading-relaxed">
                Total overdue debt of{' '}
                <strong className="font-mono">
                  {formatCurrency(totalOverdueAmount, settings.currencySymbol, settings.currency)}
                </strong>{' '}
                has passed the scheduled due date. Banks may levy late payment penalties or penal interest until settled.
              </p>
            </div>
          </div>

          <div className="text-right sm:self-center shrink-0">
            <div className="text-[10px] text-rose-700 dark:text-rose-300 uppercase tracking-wider font-semibold">
              Total Overdue
            </div>
            <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
              {formatCurrency(totalOverdueAmount, settings.currencySymbol, settings.currency)}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Zero Overdue Payments
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Congratulations! All your loan EMIs are strictly up to date.
          </p>
        </div>
      )}

      {/* Overdue Items List */}
      {overdueList.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
          {overdueList.map((item) => {
            const unpaidPart = item.emiAmount - item.paidAmount;

            return (
              <div
                key={`${item.loanId}_${item.paymentNo}`}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      onClick={() => onSelectLoan(item.loanId)}
                      className="font-semibold text-sm text-slate-900 dark:text-white hover:underline cursor-pointer"
                    >
                      {item.loanName}
                    </span>
                    <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                      EMI #{item.paymentNo}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded">
                      {item.daysOverdue} days overdue
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                    <span>{item.lender}</span>
                    <span>·</span>
                    <span>{item.loanType}</span>
                    <span>·</span>
                    <span className="font-mono">Ref: {item.accountNumber || 'N/A'}</span>
                    <span>·</span>
                    <span>Due: {formatDate(item.dueDate, settings.dateFormat)}</span>
                  </div>

                  {item.paidAmount > 0 && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-mono">
                      Partial paid: {formatCurrency(item.paidAmount, settings.currencySymbol, settings.currency)} |
                      Remaining: {formatCurrency(unpaidPart, settings.currencySymbol, settings.currency)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 self-end md:self-center">
                  <div className="text-right">
                    <div className="text-xs text-slate-600 dark:text-slate-300">Overdue Balance</div>
                    <div className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatCurrency(unpaidPart, settings.currencySymbol, settings.currency)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onQuickPay(item.loanId, item.paymentNo)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
                    >
                      Clear Dues
                    </button>
                    <button
                      onClick={() => onSelectLoan(item.loanId)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      View Loan
                    </button>
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

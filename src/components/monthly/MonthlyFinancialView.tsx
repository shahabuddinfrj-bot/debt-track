import React, { useState, useMemo } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, getDaysDifference } from '../../utils/formatters';

interface MonthlyFinancialViewProps {
  settings: UserSettings;
}

export const MonthlyFinancialView: React.FC<MonthlyFinancialViewProps> = ({ settings }) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  const loans = storageService.getLoans(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Aggregate monthly data for selected year
  const monthlyData = useMemo(() => {
    return monthNames.map((monthName, idx) => {
      const monthNumStr = String(idx + 1).padStart(2, '0');
      const yearMonthPrefix = `${selectedYear}-${monthNumStr}`;

      let totalEmiDue = 0;
      let totalEmiPaid = 0;
      let totalPrincipalPaid = 0;
      let totalInterestPaid = 0;
      let pendingEmi = 0;
      let overdueEmi = 0;
      let totalInstallmentsCount = 0;

      loans.forEach((loan) => {
        const schedule = storageService.getSchedule(loan.id);
        schedule.forEach((item) => {
          if (!item.dueDate.startsWith(yearMonthPrefix)) return;

          totalInstallmentsCount++;
          totalEmiDue += item.emiAmount;

          if (item.status === 'PAID') {
            totalEmiPaid += item.emiAmount;
            totalPrincipalPaid += item.principalComponent;
            totalInterestPaid += item.interestComponent;
          } else if (item.status === 'PARTIAL') {
            totalEmiPaid += item.paidAmount || 0;
            const interestPortion = Math.min(item.paidAmount || 0, item.interestComponent);
            totalInterestPaid += interestPortion;
            totalPrincipalPaid += Math.max(0, (item.paidAmount || 0) - interestPortion);
            pendingEmi += item.emiAmount - (item.paidAmount || 0);
          } else {
            // Pending
            const diff = getDaysDifference(item.dueDate, CURRENT_DATE_STR);
            if (diff < 0 || item.status === 'OVERDUE') {
              overdueEmi += item.emiAmount;
            } else {
              pendingEmi += item.emiAmount;
            }
          }
        });
      });

      return {
        monthIndex: idx,
        monthName,
        totalEmiDue,
        totalEmiPaid,
        totalPrincipalPaid,
        totalInterestPaid,
        pendingEmi,
        overdueEmi,
        totalInstallmentsCount,
      };
    });
  }, [loans, selectedYear]);

  // Year totals
  const yearTotalDue = monthlyData.reduce((sum, m) => sum + m.totalEmiDue, 0);
  const yearTotalPaid = monthlyData.reduce((sum, m) => sum + m.totalEmiPaid, 0);
  const yearTotalPrincipal = monthlyData.reduce((sum, m) => sum + m.totalPrincipalPaid, 0);
  const yearTotalInterest = monthlyData.reduce((sum, m) => sum + m.totalInterestPaid, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Year Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Monthly Financial Ledger
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Full annual month-by-month cashflow breakdown of debt servicing, principal payoff, and interest.
          </p>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-xs self-start sm:self-auto">
          {[2024, 2025, 2026, 2027, 2028].map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-3 py-1 text-xs rounded-md font-mono font-medium transition-colors ${
                selectedYear === yr
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Year Summary Card */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
            {selectedYear} Total EMI Due
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
            {formatCurrency(yearTotalDue, settings.currencySymbol, settings.currency)}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
            {selectedYear} Total Repaid
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
            {formatCurrency(yearTotalPaid, settings.currencySymbol, settings.currency)}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
            Principal Cleared
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
            {formatCurrency(yearTotalPrincipal, settings.currencySymbol, settings.currency)}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
            Interest Serviced
          </div>
          <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
            {formatCurrency(yearTotalInterest, settings.currencySymbol, settings.currency)}
          </div>
        </div>
      </div>

      {/* 12 Months Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold">
              <tr>
                <th className="py-3 px-4">Month</th>
                <th className="py-3 px-4 text-center">EMIs</th>
                <th className="py-3 px-4 text-right">Total Due</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Principal Paid</th>
                <th className="py-3 px-4 text-right">Interest Paid</th>
                <th className="py-3 px-4 text-right">Pending EMI</th>
                <th className="py-3 px-4 text-right">Overdue EMI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {monthlyData.map((m) => {
                const isCurrentMonth =
                  selectedYear === 2026 && m.monthIndex === 9; // October 2026

                return (
                  <tr
                    key={m.monthIndex}
                    className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                      isCurrentMonth ? 'bg-amber-50/20 dark:bg-amber-950/10 font-semibold' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-sans text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span>{m.monthName}</span>
                        {isCurrentMonth && (
                          <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-normal">
                            (Current)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300">
                      {m.totalInstallmentsCount}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(m.totalEmiDue, settings.currencySymbol, settings.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(m.totalEmiPaid, settings.currencySymbol, settings.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(m.totalPrincipalPaid, settings.currencySymbol, settings.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {formatCurrency(m.totalInterestPaid, settings.currencySymbol, settings.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {formatCurrency(m.pendingEmi, settings.currencySymbol, settings.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {m.overdueEmi > 0
                        ? formatCurrency(m.overdueEmi, settings.currencySymbol, settings.currency)
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

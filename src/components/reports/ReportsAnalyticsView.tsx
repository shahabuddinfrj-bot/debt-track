import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Flame,
  Info,
  Layers,
  PieChart,
  Printer,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate, formatMonthYear } from '../../utils/formatters';
import { FinancialReportPDFModal } from './FinancialReportPDFModal';

interface ReportsAnalyticsViewProps {
  settings: UserSettings;
}

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsViewProps> = ({ settings }) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [inspectedMonthIdx, setInspectedMonthIdx] = useState<number | null>(9); // Default to October (month index 9)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const loans = storageService.getLoans(false);
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE');
  const metrics = storageService.getDashboardMetrics();

  // 1. Debt by Loan Type
  const debtByType = useMemo(() => {
    const map: Record<string, number> = {};
    activeLoans.forEach((l) => {
      map[l.loanType] = (map[l.loanType] || 0) + l.outstandingPrincipal;
    });
    return Object.entries(map)
      .map(([type, amount]) => ({
        type,
        amount,
        pct: metrics.totalOutstanding > 0 ? (amount / metrics.totalOutstanding) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [activeLoans, metrics.totalOutstanding]);

  // 2. Debt by Lender
  const debtByLender = useMemo(() => {
    const map: Record<string, number> = {};
    activeLoans.forEach((l) => {
      map[l.lender] = (map[l.lender] || 0) + l.outstandingPrincipal;
    });
    return Object.entries(map)
      .map(([lender, amount]) => ({
        lender,
        amount,
        pct: metrics.totalOutstanding > 0 ? (amount / metrics.totalOutstanding) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [activeLoans, metrics.totalOutstanding]);

  // 3. Loan Closure Timeline sorted chronologically
  const closureTimeline = useMemo(() => {
    return [...activeLoans]
      .filter((l) => l.expectedClosureDate)
      .sort((a, b) => a.expectedClosureDate.localeCompare(b.expectedClosureDate));
  }, [activeLoans]);

  // 4. Annual Calendar Heatmap calculation
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const annualHeatmapData = useMemo(() => {
    // Build array of 12 months
    const months = Array.from({ length: 12 }, (_, mIdx) => {
      const monthPrefix = `${selectedYear}-${String(mIdx + 1).padStart(2, '0')}`;
      let totalAmount = 0;
      let totalInstallments = 0;
      const loanObligations: {
        loanId: string;
        loanName: string;
        lender: string;
        loanType: string;
        amount: number;
        dueDate: string;
        status: string;
      }[] = [];

      loans.forEach((loan) => {
        const schedule = storageService.getSchedule(loan.id);
        schedule.forEach((item) => {
          if (item.dueDate.startsWith(monthPrefix)) {
            totalAmount += item.emiAmount;
            totalInstallments++;
            loanObligations.push({
              loanId: loan.id,
              loanName: loan.name,
              lender: loan.lender,
              loanType: loan.loanType,
              amount: item.emiAmount,
              dueDate: item.dueDate,
              status: item.status,
            });
          }
        });
      });

      return {
        monthIndex: mIdx,
        monthName: monthNames[mIdx],
        shortName: shortMonthNames[mIdx],
        totalAmount,
        totalInstallments,
        loansCount: loanObligations.length,
        obligations: loanObligations.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      };
    });

    const maxMonthAmount = Math.max(...months.map((m) => m.totalAmount), 0);
    const minMonthAmount = Math.min(
      ...months.filter((m) => m.totalAmount > 0).map((m) => m.totalAmount),
      maxMonthAmount
    );
    const monthsWithPayments = months.filter((m) => m.totalAmount > 0);
    const avgMonthlyAmount =
      monthsWithPayments.length > 0
        ? monthsWithPayments.reduce((acc, m) => acc + m.totalAmount, 0) / monthsWithPayments.length
        : 0;

    // Identify peak month
    const peakMonth = months.reduce((prev, curr) => (curr.totalAmount > prev.totalAmount ? curr : prev), months[0]);

    return {
      months,
      maxMonthAmount,
      minMonthAmount,
      avgMonthlyAmount,
      peakMonth,
    };
  }, [loans, selectedYear]);

  // 5. Day-of-Month Cashflow Clustering (1 to 31) for the selected year
  const dayOfMonthClusters = useMemo(() => {
    const daysMap: Record<number, { amount: number; count: number }> = {};
    for (let d = 1; d <= 31; d++) {
      daysMap[d] = { amount: 0, count: 0 };
    }

    loans.forEach((loan) => {
      const schedule = storageService.getSchedule(loan.id);
      schedule.forEach((item) => {
        if (item.dueDate.startsWith(`${selectedYear}-`)) {
          const parts = item.dueDate.split('-');
          const day = parseInt(parts[2], 10);
          if (daysMap[day]) {
            daysMap[day].amount += item.emiAmount;
            daysMap[day].count++;
          }
        }
      });
    });

    const maxDayAmount = Math.max(...Object.values(daysMap).map((d) => d.amount), 1);

    return {
      daysMap,
      maxDayAmount,
    };
  }, [loans, selectedYear]);

  // Color intensity helper for heatmap cells
  const getHeatmapColorClass = (amount: number, max: number) => {
    if (amount <= 0 || max <= 0) {
      return 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500';
    }
    const ratio = amount / max;
    if (ratio < 0.25) {
      return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200';
    }
    if (ratio < 0.55) {
      return 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100';
    }
    if (ratio < 0.85) {
      return 'bg-rose-100 dark:bg-rose-900/50 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100';
    }
    // Peak / High tier
    return 'bg-rose-600 dark:bg-rose-700 border-rose-700 dark:border-rose-600 text-white font-semibold shadow-xs';
  };

  const COLORS = ['#0284c7', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6'];

  const inspectedMonthData =
    inspectedMonthIdx !== null ? annualHeatmapData.months[inspectedMonthIdx] : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Debt Reports & Analytics
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Real-time mathematical analytics and cashflow density models computed directly from your loan schedules.
          </p>
        </div>

        <button
          onClick={() => setIsPdfModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Report as PDF</span>
        </button>
      </div>

      {/* Top 3 Analytical KPI Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1 */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
            Total Outstanding Principal
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-1">
            {formatCurrency(metrics.totalOutstanding, settings.currencySymbol, settings.currency)}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Current liability remaining across {activeLoans.length} active loans.
          </p>
        </div>

        {/* KPI 2 */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
            Lifetime Interest Serviced
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 tabular-nums mt-1">
            {formatCurrency(metrics.totalInterestPaid, settings.currencySymbol, settings.currency)}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Remaining interest liability: {formatCurrency(metrics.totalInterestRemaining, settings.currencySymbol, settings.currency)}
          </p>
        </div>

        {/* KPI 3 */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
            Total Borrowed Capital
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-1">
            {formatCurrency(metrics.totalPrincipalBorrowed, settings.currencySymbol, settings.currency)}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            {metrics.overallRepaymentProgress}% overall repayment progress achieved.
          </p>
        </div>
      </div>

      {/* =========================================================================
          CALENDAR HEATMAP: ANNUAL EMI PAYMENT DENSITY & PEAK OBLIGATIONS
          ========================================================================= */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-5">
        {/* Heatmap Header & Year Picker */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Annual EMI Payment Density Heatmap
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Heat-density visualization identifying months with peak cashflow obligations and debt relief drop-offs.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start sm:self-auto text-xs">
            {[2024, 2025, 2026, 2027, 2028].map((yr) => (
              <button
                key={yr}
                onClick={() => {
                  setSelectedYear(yr);
                  setInspectedMonthIdx(null);
                }}
                className={`px-3 py-1 rounded-md font-mono transition-colors ${
                  selectedYear === yr
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Peak & Average Analytical Insights Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Peak Obligation Month
            </div>
            <div className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              {annualHeatmapData.peakMonth.totalAmount > 0
                ? `${annualHeatmapData.peakMonth.monthName} ${selectedYear}`
                : 'No payments'}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
              {formatCurrency(annualHeatmapData.peakMonth.totalAmount, settings.currencySymbol, settings.currency)} ({annualHeatmapData.peakMonth.loansCount} installments)
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Average Monthly Commitment
            </div>
            <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              {formatCurrency(annualHeatmapData.avgMonthlyAmount, settings.currencySymbol, settings.currency)}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Across active payment months in {selectedYear}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Annual Debt Outflow
            </div>
            <div className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
              {formatCurrency(
                annualHeatmapData.months.reduce((acc, m) => acc + m.totalAmount, 0),
                settings.currencySymbol,
                settings.currency
              )}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
              {annualHeatmapData.months.reduce((acc, m) => acc + m.totalInstallments, 0)} total installments
            </div>
          </div>
        </div>

        {/* 12-Month Heatmap Grid */}
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Monthly Obligation Density ({selectedYear})
            </span>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
              <span>Less</span>
              <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"></span>
              <span className="w-3 h-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800"></span>
              <span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700"></span>
              <span className="w-3 h-3 rounded bg-rose-100 dark:bg-rose-900/60 border border-rose-300 dark:border-rose-700"></span>
              <span className="w-3 h-3 rounded bg-rose-600 border border-rose-700"></span>
              <span>Peak Debt</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {annualHeatmapData.months.map((m) => {
              const isPeak =
                annualHeatmapData.peakMonth.totalAmount > 0 &&
                m.totalAmount === annualHeatmapData.peakMonth.totalAmount;
              const isInspected = inspectedMonthIdx === m.monthIndex;
              const colorClass = getHeatmapColorClass(m.totalAmount, annualHeatmapData.maxMonthAmount);

              return (
                <button
                  key={m.monthIndex}
                  onClick={() => setInspectedMonthIdx(m.monthIndex)}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[96px] ${colorClass} ${
                    isInspected
                      ? 'ring-2 ring-slate-900 dark:ring-white scale-[1.02]'
                      : 'hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold font-sans">
                      {m.shortName}
                    </span>
                    {isPeak && (
                      <span className="text-[9px] font-mono uppercase px-1 rounded bg-black/20 text-white font-bold">
                        Peak
                      </span>
                    )}
                  </div>

                  <div className="my-1">
                    <div className="text-sm font-bold font-mono tabular-nums leading-tight">
                      {m.totalAmount > 0
                        ? formatCurrency(m.totalAmount, settings.currencySymbol, settings.currency)
                        : '—'}
                    </div>
                  </div>

                  <div className="text-[10px] font-mono opacity-80 flex items-center justify-between">
                    <span>{m.loansCount} EMI{m.loansCount !== 1 ? 's' : ''}</span>
                    <span>{selectedYear}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Inspection Drawer for Selected Heatmap Month */}
        {inspectedMonthData && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span className="font-bold text-slate-900 dark:text-white">
                  {inspectedMonthData.monthName} {selectedYear} Loan Breakdown
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  · Total Obligation: {formatCurrency(inspectedMonthData.totalAmount, settings.currencySymbol, settings.currency)}
                </span>
              </div>
              <button
                onClick={() => setInspectedMonthIdx(null)}
                className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Close details
              </button>
            </div>

            {inspectedMonthData.obligations.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No active loans or scheduled installments due in {inspectedMonthData.monthName} {selectedYear}.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {inspectedMonthData.obligations.map((item, idx) => (
                  <div
                    key={`${item.loanId}_${idx}`}
                    className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {item.loanName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {formatDate(item.dueDate, settings.dateFormat)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {item.lender} · {item.loanType}
                    </div>
                    <div className="pt-1 flex items-center justify-between font-mono font-semibold text-slate-900 dark:text-white">
                      <span>EMI:</span>
                      <span className="text-rose-600 dark:text-rose-400">
                        {formatCurrency(item.amount, settings.currencySymbol, settings.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Day-of-Month Clustering Heatmap (Days 1 to 31) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Monthly Due Date Clustering (Cashflow Timing)
              </span>
              <p className="text-[11px] text-slate-500">
                Identifies which days of the month experience the heaviest debit concentrations throughout {selectedYear}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-16 lg:grid-cols-31 gap-1 pt-1">
            {Array.from({ length: 31 }, (_, i) => {
              const day = i + 1;
              const data = dayOfMonthClusters.daysMap[day] || { amount: 0, count: 0 };
              const ratio = dayOfMonthClusters.maxDayAmount > 0 ? data.amount / dayOfMonthClusters.maxDayAmount : 0;

              let bg = 'bg-slate-100 dark:bg-slate-800/40 text-slate-400';
              if (data.amount > 0) {
                if (ratio < 0.3) bg = 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold';
                else if (ratio < 0.7) bg = 'bg-rose-200 dark:bg-rose-900/60 text-rose-950 dark:text-rose-100 font-semibold';
                else bg = 'bg-rose-600 text-white font-bold shadow-xs';
              }

              return (
                <div
                  key={day}
                  className={`p-1.5 rounded text-center text-[10px] font-mono transition-transform hover:scale-105 cursor-default ${bg}`}
                  title={`Day ${day}: ${formatCurrency(data.amount, settings.currencySymbol, settings.currency)} (${data.count} installments across year)`}
                >
                  <div className="text-[9px] opacity-75">{day}</div>
                  <div className="truncate font-semibold mt-0.5">
                    {data.amount > 0 ? `${Math.round(data.amount / 1000)}k` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Visual Distribution Charts (Loan Type & Lender Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Debt by Loan Type */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Outstanding Debt by Loan Type
          </h3>

          <div className="space-y-3">
            {debtByType.map((item, idx) => (
              <div key={item.type} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {item.type}
                    </span>
                  </div>
                  <div className="font-mono text-slate-900 dark:text-white font-semibold">
                    {formatCurrency(item.amount, settings.currencySymbol, settings.currency)}{' '}
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-normal">
                      ({item.pct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${item.pct}%`,
                      backgroundColor: COLORS[idx % COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Debt by Lender */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Outstanding Debt by Lending Institution
          </h3>

          <div className="space-y-3">
            {debtByLender.map((item, idx) => (
              <div key={item.lender} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {item.lender}
                  </span>
                  <div className="font-mono text-slate-900 dark:text-white font-semibold">
                    {formatCurrency(item.amount, settings.currencySymbol, settings.currency)}{' '}
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-normal">
                      ({item.pct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-800 dark:bg-slate-200 rounded-full transition-all duration-300"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Loan Closure Timeline (Section 21) */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Loan Closure & Debt Freedom Timeline
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Chronological projection of when each active loan is scheduled to be completely paid off.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {closureTimeline.map((loan, idx) => (
            <div
              key={loan.id}
              className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs space-y-2 relative"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Step {idx + 1}
                </span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {formatMonthYear(loan.expectedClosureDate)}
                </span>
              </div>
              <div className="font-semibold text-slate-900 dark:text-white truncate">
                {loan.name}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                {loan.lender} · {loan.loanType}
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-600 dark:text-slate-300">Outstanding:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(loan.outstandingPrincipal, settings.currencySymbol, settings.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Report PDF Export Modal */}
      <FinancialReportPDFModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        settings={settings}
        selectedYear={selectedYear}
      />
    </div>
  );
};


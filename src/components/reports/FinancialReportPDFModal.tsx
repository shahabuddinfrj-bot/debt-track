import React from 'react';
import { X, Printer, Download, FileText, CheckCircle2, Shield } from 'lucide-react';
import { Loan, UserSettings, DashboardMetrics } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate, formatMonthYear } from '../../utils/formatters';

interface FinancialReportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  selectedYear: number;
}

export const FinancialReportPDFModal: React.FC<FinancialReportPDFModalProps> = ({
  isOpen,
  onClose,
  settings,
  selectedYear,
}) => {
  if (!isOpen) return null;

  const loans = storageService.getLoans(false);
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE');
  const metrics = storageService.getDashboardMetrics();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Compute 12-month data for the selected year
  const monthlyData = monthNames.map((monthName, mIdx) => {
    const monthPrefix = `${selectedYear}-${String(mIdx + 1).padStart(2, '0')}`;
    let totalDue = 0;
    let totalPaid = 0;
    let principalPaid = 0;
    let interestPaid = 0;
    let count = 0;

    loans.forEach((loan) => {
      const schedule = storageService.getSchedule(loan.id);
      schedule.forEach((item) => {
        if (item.dueDate.startsWith(monthPrefix)) {
          totalDue += item.emiAmount;
          count++;
          if (item.status === 'PAID') {
            totalPaid += item.emiAmount;
            principalPaid += item.principalComponent;
            interestPaid += item.interestComponent;
          } else if (item.status === 'PARTIAL') {
            totalPaid += item.paidAmount || 0;
            const intPart = Math.min(item.paidAmount || 0, item.interestComponent);
            interestPaid += intPart;
            principalPaid += Math.max(0, (item.paidAmount || 0) - intPart);
          }
        }
      });
    });

    return {
      monthName,
      shortName: monthName.substring(0, 3),
      totalDue,
      totalPaid,
      principalPaid,
      interestPaid,
      count,
    };
  });

  const yearTotalDue = monthlyData.reduce((acc, m) => acc + m.totalDue, 0);
  const yearTotalPaid = monthlyData.reduce((acc, m) => acc + m.totalPaid, 0);
  const peakMonth = monthlyData.reduce((prev, curr) => (curr.totalDue > prev.totalDue ? curr : prev), monthlyData[0]);

  // Closure roadmap
  const sortedClosures = [...activeLoans]
    .filter((l) => l.expectedClosureDate)
    .sort((a, b) => a.expectedClosureDate.localeCompare(b.expectedClosureDate));

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const userMeta = [
      `"Borrower Name","शाहबुद्दीन (Shahabuddin)"`,
      `"Mobile","9042233122"`,
      `"Email","shahabuddin.frj@gmail.com"`,
      `"Address","No. 72, 6th Cross, JJ Nagar, Moolakulam, Pondicherry - 605010"`,
      `"Reporting Year","${selectedYear}"`,
      `"Report Date","${formatDate(CURRENT_DATE_STR, settings.dateFormat)}"`,
      `"Ref ID","${reportRefCode}"`,
      '',
    ];

    const headers = [
      'Month',
      'Year',
      'Total EMI Due',
      'Total EMI Paid',
      'Principal Component Paid',
      'Interest Component Paid',
      'Active Installments',
    ];

    const rows = monthlyData.map((m) => [
      m.monthName,
      selectedYear,
      m.totalDue,
      m.totalPaid,
      m.principalPaid,
      m.interestPaid,
      m.count,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [...userMeta, headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `DebtTrack_Annual_Report_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportRefCode = `REP-${selectedYear}-${Date.now().toString().slice(-6)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl max-w-4xl w-full my-6 shadow-2xl flex flex-col max-h-[94vh]">
        {/* Controls Bar (Excluded from print output) */}
        <div className="no-print flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700" />
            <span className="text-sm font-bold text-slate-900">
              Annual Financial & EMI Debt Portfolio Report
            </span>
            <span className="text-xs font-mono text-slate-500">({selectedYear})</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Download Report as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Body */}
        <div className="p-8 md:p-10 overflow-y-auto space-y-6 text-xs text-slate-900 font-sans print:p-0 print:space-y-4">
          {/* Document Header Lockup */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-5 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  DT
                </div>
                <span className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  DebtTrack Financial Intelligence
                </span>
              </div>
              <h1 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Comprehensive Debt Portfolio & Annual EMI Obligation Report
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Official statement of all personal loans, mortgages, vehicle loans, and repayment schedules.
              </p>
            </div>

            <div className="text-left sm:text-right font-mono text-xs space-y-0.5 shrink-0">
              <div className="font-bold text-slate-900">
                Date: {formatDate(CURRENT_DATE_STR, settings.dateFormat)}
              </div>
              <div className="text-slate-500">Ref ID: {reportRefCode}</div>
              <div className="text-slate-500">Reporting Year: {selectedYear}</div>
            </div>
          </div>

          {/* User Profile / Account Holder Header Information */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 sm:p-4 text-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Borrower / Account Holder Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Name</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">शाहबुद्दीन (Shahabuddin)</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Mobile</span>
                <span className="font-semibold text-slate-900 font-mono block mt-0.5">9042233122</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Email</span>
                <span className="font-semibold text-slate-900 break-all block mt-0.5">shahabuddin.frj@gmail.com</span>
              </div>
              <div className="sm:col-span-2 md:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Address</span>
                <span className="text-slate-800 leading-snug block mt-0.5">
                  No. 72, 6th Cross, JJ Nagar, Moolakulam, Pondicherry - 605010
                </span>
              </div>
            </div>
          </div>

          {/* Executive KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[10px] uppercase font-bold text-slate-500">
                Total Outstanding Debt
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                {formatCurrency(metrics.totalOutstanding, settings.currencySymbol, settings.currency)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {activeLoans.length} active facilities
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[10px] uppercase font-bold text-slate-500">
                Monthly EMI Commitment
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                {formatCurrency(metrics.totalMonthlyEmi, settings.currencySymbol, settings.currency)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Current monthly cashflow
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[10px] uppercase font-bold text-slate-500">
                Principal Repaid
              </div>
              <div className="text-lg font-bold font-mono text-emerald-800 tabular-nums mt-0.5">
                {formatCurrency(metrics.totalPrincipalRepaid, settings.currencySymbol, settings.currency)}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                {metrics.overallRepaymentProgress}% Debt Freedom
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[10px] uppercase font-bold text-slate-500">
                Lifetime Interest Serviced
              </div>
              <div className="text-lg font-bold font-mono text-amber-800 tabular-nums mt-0.5">
                {formatCurrency(metrics.totalInterestPaid, settings.currencySymbol, settings.currency)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Remaining: {formatCurrency(metrics.totalInterestRemaining, settings.currencySymbol, settings.currency)}
              </div>
            </div>
          </div>

          {/* Active Loans Register Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Active Loan Facilities Register
              </h2>
              <span className="text-[10px] font-mono text-slate-500">
                {activeLoans.length} Facilities Listed
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Facility Name</th>
                    <th className="py-2 px-3">Lender & Type</th>
                    <th className="py-2 px-3 text-right">Original Amount</th>
                    <th className="py-2 px-3 text-right">Outstanding</th>
                    <th className="py-2 px-3 text-right">ROI (%)</th>
                    <th className="py-2 px-3 text-right">Monthly EMI</th>
                    <th className="py-2 px-3 text-center">Progress</th>
                    <th className="py-2 px-3">Expected Closure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeLoans.map((l) => {
                    const progress =
                      l.originalAmount > 0
                        ? Math.min(100, Math.round(((l.originalAmount - l.outstandingPrincipal) / l.originalAmount) * 100))
                        : 0;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                          {l.name}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-600">
                          {l.lender} ({l.loanType})
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                          {formatCurrency(l.originalAmount, settings.currencySymbol, settings.currency)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">
                          {formatCurrency(l.outstandingPrincipal, settings.currencySymbol, settings.currency)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                          {l.interestRate}%
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-900">
                          {formatCurrency(l.emiAmount, settings.currencySymbol, settings.currency)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {progress}%
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {formatMonthYear(l.expectedClosureDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Annual EMI Payment Density & Monthly Cashflow Schedule */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                {selectedYear} Annual EMI Payment Density Schedule
              </h2>
              <span className="text-[10px] font-mono text-slate-600">
                Peak Obligation: {peakMonth.monthName} ({formatCurrency(peakMonth.totalDue, settings.currencySymbol, settings.currency)})
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3 text-center">Installments</th>
                    <th className="py-2 px-3 text-right">Total Due</th>
                    <th className="py-2 px-3 text-right">Total Paid</th>
                    <th className="py-2 px-3 text-right">Principal Component</th>
                    <th className="py-2 px-3 text-right">Interest Component</th>
                    <th className="py-2 px-3 text-center">Density Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyData.map((m) => {
                    const isPeak = m.totalDue > 0 && m.totalDue === peakMonth.totalDue;
                    return (
                      <tr key={m.monthName} className={isPeak ? 'bg-rose-50/40 font-semibold' : ''}>
                        <td className="py-1.5 px-3 font-sans text-slate-900">
                          {m.monthName}
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-600">
                          {m.count}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-slate-900">
                          {formatCurrency(m.totalDue, settings.currencySymbol, settings.currency)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-emerald-800">
                          {formatCurrency(m.totalPaid, settings.currencySymbol, settings.currency)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-slate-700">
                          {formatCurrency(m.principalPaid, settings.currencySymbol, settings.currency)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-amber-800">
                          {formatCurrency(m.interestPaid, settings.currencySymbol, settings.currency)}
                        </td>
                        <td className="py-1.5 px-3 text-center text-[10px]">
                          {isPeak ? (
                            <span className="font-bold text-rose-700 uppercase">Peak Month</span>
                          ) : m.totalDue > 0 ? (
                            <span className="text-slate-600">Active</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <td className="py-2 px-3 font-sans">Annual Total ({selectedYear})</td>
                    <td className="py-2 px-3 text-center">{monthlyData.reduce((a, b) => a + b.count, 0)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(yearTotalDue, settings.currencySymbol, settings.currency)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-800">{formatCurrency(yearTotalPaid, settings.currencySymbol, settings.currency)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatCurrency(monthlyData.reduce((a, b) => a + b.principalPaid, 0), settings.currencySymbol, settings.currency)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-800">{formatCurrency(monthlyData.reduce((a, b) => a + b.interestPaid, 0), settings.currencySymbol, settings.currency)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Debt Freedom Milestone Roadmap */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Loan Closure & Debt Freedom Milestones
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sortedClosures.map((l, idx) => (
                <div key={l.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Step {idx + 1}</div>
                  <div className="font-bold text-slate-900 truncate mt-0.5">{l.name}</div>
                  <div className="text-emerald-800 font-semibold font-mono mt-1">
                    Payoff: {formatMonthYear(l.expectedClosureDate)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document Footer Verification */}
          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              Generated via DebtTrack Personal Finance Engine · Single Source of Truth Amortization Records
            </div>
            <div className="font-mono">
              Certified Personal Document · Confidential
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

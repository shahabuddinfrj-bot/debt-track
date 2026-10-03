import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  HelpCircle,
  Plus,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  RefreshCw,
  PiggyBank,
  Landmark,
} from 'lucide-react';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate, formatMonthYear, getDaysDifference } from '../../utils/formatters';

interface DashboardViewProps {
  settings: UserSettings;
  onNavigate: (view: string) => void;
  onOpenAddLoan: () => void;
  onSelectLoan: (loanId: string) => void;
  onQuickPay: (loanId: string, emiPaymentNo?: number) => void;
  onLoadDemoData: () => void;
  refreshTrigger?: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  settings,
  onNavigate,
  onOpenAddLoan,
  onSelectLoan,
  onQuickPay,
  onLoadDemoData,
}) => {
  const metrics = storageService.getDashboardMetrics();
  const overdueSummary = storageService.getOverdueSummary();
  const loans = storageService.getLoans(false);
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE');
  const closedLoans = loans.filter((l) => l.status === 'CLOSED' || l.status === 'FORECLOSED');

  // Find loans finishing earliest and latest
  const sortedByClosure = [...activeLoans]
    .filter((l) => l.expectedClosureDate)
    .sort((a, b) => a.expectedClosureDate.localeCompare(b.expectedClosureDate));

  const earliestFinishingLoan = sortedByClosure[0] || null;
  const latestFinishingLoan = sortedByClosure[sortedByClosure.length - 1] || null;

  // Total EMIs remaining across active loans
  const totalEmisRemaining = activeLoans.reduce((sum, l) => sum + (l.emisRemaining || 0), 0);

  // If no loans at all, show friendly empty state
  if (loans.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mx-auto flex items-center justify-center mb-5 shadow-xs">
          <Wallet className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
          Track Every Loan & EMI in One Place
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-8 leading-relaxed">
          Add your first personal, home, vehicle, or credit card loan to automatically generate
          amortization schedules, track repayments, and monitor debt freedom.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onOpenAddLoan}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Your First Loan</span>
          </button>
          <button
            onClick={async () => {
              await storageService.pullFromServer();
              window.location.reload();
            }}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sync Accounts from Cloud</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Intelligent Alerts Banner */}
      <div className="space-y-2">
        {loans.some((l) => l.isDemo) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold">Sample Demo Accounts Active:</span> These are sample accounts. If you have real accounts on your computer, click "Clear Demo & Pull from Cloud".
              </div>
            </div>
            <button
              onClick={async () => {
                storageService.clearDemoData();
                await storageService.pullFromServer();
                window.location.reload();
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Clear Demo & Sync from Cloud
            </button>
          </div>
        )}
        {overdueSummary.overdueCount > 0 && (
          <div className="flex items-center justify-between p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold">Payment Alert:</span> You have{' '}
                <span className="font-mono font-bold">{overdueSummary.overdueCount}</span> overdue EMI
                totaling{' '}
                <span className="font-mono font-bold">
                  {formatCurrency(overdueSummary.overdueAmount, settings.currencySymbol, settings.currency)}
                </span>
                .
              </div>
            </div>
            <button
              onClick={() => onNavigate('overdue')}
              className="text-xs font-semibold underline hover:no-underline ml-4 whitespace-nowrap text-rose-700 dark:text-rose-300"
            >
              Resolve Overdue &rarr;
            </button>
          </div>
        )}

        {metrics.nextEmiDue && metrics.nextEmiDue.daysRemaining <= 7 && metrics.nextEmiDue.daysRemaining >= 0 && (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold">Upcoming EMI:</span> Next installment of{' '}
                <span className="font-mono font-bold">
                  {formatCurrency(metrics.nextEmiDue.amount, settings.currencySymbol, settings.currency)}
                </span>{' '}
                for <span className="font-medium">{metrics.nextEmiDue.loanName}</span> ({metrics.nextEmiDue.lender}) is due{' '}
                <span className="font-semibold">
                  {metrics.nextEmiDue.daysRemaining === 0
                    ? 'today'
                    : metrics.nextEmiDue.daysRemaining === 1
                    ? 'tomorrow'
                    : `in ${metrics.nextEmiDue.daysRemaining} days`}{' '}
                  ({formatDate(metrics.nextEmiDue.dueDate, settings.dateFormat)})
                </span>
                .
              </div>
            </div>
            <button
              onClick={() => onQuickPay(metrics.nextEmiDue!.loanId)}
              className="px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors whitespace-nowrap ml-3"
            >
              Mark Paid
            </button>
          </div>
        )}
      </div>

      {/* Unified Monthly Financial Commitments (Section 2, 11, 12 requirement) */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white rounded-2xl shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Unified Monthly Financial Commitments</span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Aggregated recurring monthly outflows: Loan EMIs (Debt Repayments) + Deposit Contributions (Savings)
            </p>
          </div>
          <button
            onClick={() => onNavigate('deposits')}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>Manage Deposits</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-700/60">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
              Total Loan EMI (Borrowing)
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {formatCurrency(metrics.totalMonthlyEmi, settings.currencySymbol, settings.currency)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.activeLoansCount} active borrowing loans
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="text-[11px] text-emerald-400 font-medium uppercase tracking-wider">
              Total Deposit Contribution (Savings)
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(metrics.totalMonthlyDeposit, settings.currencySymbol, settings.currency)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.activeDepositsCount} recurring savings/RD plans
            </div>
          </div>

          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
            <div className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
              Total Monthly Commitment
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
              {formatCurrency(metrics.totalMonthlyCommitment, settings.currencySymbol, settings.currency)}
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">
              Loan EMI + Deposit Contribution
            </div>
          </div>
        </div>
      </div>

      {/* Main Stat Grid: 8 core loan metrics (100% PRESERVED) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
            Total Outstanding
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(metrics.totalOutstanding, settings.currencySymbol, settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
            Across {metrics.activeLoansCount} active loans
          </div>
        </div>

        {/* Monthly EMI Commitment */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
            Monthly EMI Commitment
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(metrics.totalMonthlyEmi, settings.currencySymbol, settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
            {metrics.emisDueThisMonth} EMIs due this month
          </div>
        </div>

        {/* Next EMI Due */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
            Next EMI Due
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {metrics.nextEmiDue
              ? formatCurrency(metrics.nextEmiDue.amount, settings.currencySymbol, settings.currency)
              : 'None'}
          </div>
          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 truncate">
            {metrics.nextEmiDue
              ? `${formatDate(metrics.nextEmiDue.dueDate, settings.dateFormat)} · ${metrics.nextEmiDue.lender}`
              : 'All paid up'}
          </div>
        </div>

        {/* Overdue Amount */}
        <div
          onClick={() => onNavigate('overdue')}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
            Overdue Amount
          </div>
          <div
            className={`text-xl md:text-2xl font-bold font-mono tabular-nums ${
              overdueSummary.overdueAmount > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {formatCurrency(overdueSummary.overdueAmount, settings.currencySymbol, settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
            {overdueSummary.overdueCount === 0
              ? 'No missed payments'
              : `${overdueSummary.overdueCount} installment overdue`}
          </div>
        </div>
      </div>

      {/* Savings & Deposit Assets Overview (Section 12, 21 requirement) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Deposit Balance */}
        <div
          onClick={() => onNavigate('deposits')}
          className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl cursor-pointer hover:border-emerald-400 transition-colors"
        >
          <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Deposit Balance</span>
            <PiggyBank className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
            {formatCurrency(metrics.totalDepositBalance, settings.currencySymbol, settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
            Across {metrics.activeDepositsCount} active deposits
          </div>
        </div>

        {/* Monthly Deposit Contribution */}
        <div
          onClick={() => onNavigate('deposits')}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500/60 transition-colors"
        >
          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
            Monthly Deposit
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(metrics.totalMonthlyDeposit, settings.currencySymbol, settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
            Recurring RD & savings
          </div>
        </div>

        {/* Net Financial Position (Assets vs Liabilities) */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Net Financial Position</span>
            <Landmark className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className={`text-xl md:text-2xl font-bold font-mono tabular-nums ${
            metrics.netFinancialPosition >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-900 dark:text-white'
          }`}>
            {formatCurrency(metrics.netFinancialPosition, settings.currencySymbol, settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
            {metrics.netFinancialPosition >= 0 ? 'Surplus (Assets > Debt)' : 'Net Debt Position'}
          </div>
        </div>

        {/* Deposits Maturing Soon */}
        <div
          onClick={() => onNavigate('deposits')}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-emerald-500/60 transition-colors"
        >
          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
            Deposits Maturing Soon
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
            {metrics.depositsMaturingSoonCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
            Within the next 90 days
          </div>
        </div>
      </div>

      {/* Repayment Progress & Debt Summary Card */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Principal Repayment Progress
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              You have repaid {metrics.overallRepaymentProgress}% of all borrowed capital.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-slate-600 dark:text-slate-300">
              Repaid:{' '}
              <strong className="text-emerald-700 dark:text-emerald-400">
                {formatCurrency(metrics.totalPrincipalRepaid, settings.currencySymbol, settings.currency)}
              </strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-600 dark:text-slate-300">
              Borrowed:{' '}
              <strong className="text-slate-900 dark:text-white">
                {formatCurrency(metrics.totalPrincipalBorrowed, settings.currencySymbol, settings.currency)}
              </strong>
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mb-5">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, metrics.overallRepaymentProgress))}%` }}
          />
        </div>

        {/* 4 Quantitative Breakdown Items */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">Principal Paid</div>
            <div className="text-sm font-semibold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {formatCurrency(metrics.totalPrincipalRepaid, settings.currencySymbol, settings.currency)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">Interest Paid to Date</div>
            <div className="text-sm font-semibold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {formatCurrency(metrics.totalInterestPaid, settings.currencySymbol, settings.currency)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">Remaining Interest</div>
            <div className="text-sm font-semibold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {formatCurrency(metrics.totalInterestRemaining, settings.currencySymbol, settings.currency)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">Remaining EMIs</div>
            <div className="text-sm font-semibold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {totalEmisRemaining} installments
            </div>
          </div>
        </div>
      </div>

      {/* Answers At-A-Glance (Section 44 Requirements) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Earliest Finishing Loan */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-between mb-2">
            <span>First Loan to Finish</span>
            <span className="text-[11px] text-slate-600 dark:text-slate-300">Milestone</span>
          </div>
          {earliestFinishingLoan ? (
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {earliestFinishingLoan.name}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {earliestFinishingLoan.lender} · {earliestFinishingLoan.loanType}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">Target Closure:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatMonthYear(earliestFinishingLoan.expectedClosureDate)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300 py-3">No active loans.</p>
          )}
        </div>

        {/* Card 2: Latest Finishing Loan */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-between mb-2">
            <span>Last Loan to Finish</span>
            <span className="text-[11px] text-slate-600 dark:text-slate-300">Long-term</span>
          </div>
          {latestFinishingLoan ? (
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {latestFinishingLoan.name}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {latestFinishingLoan.lender} · {latestFinishingLoan.loanType}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-300">Debt-Free Date:</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">
                  {formatMonthYear(latestFinishingLoan.expectedClosureDate)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300 py-3">No active loans.</p>
          )}
        </div>

        {/* Card 3: Loan Status Counts */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-between mb-2">
            <span>Portfolio Status</span>
            <span className="text-[11px] text-slate-600 dark:text-slate-300">Summary</span>
          </div>
          <div className="space-y-2 text-xs pt-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Active Loans</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {metrics.activeLoansCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Closed / Settled</span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                {metrics.closedLoansCount}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">Total Borrowed Records</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {metrics.totalLoans}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Loans Quick List */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Active Loan Obligations
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Select any loan for full repayment schedule, prepayment options, or document storage.
            </p>
          </div>
          <button
            onClick={() => onNavigate('loans')}
            className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {activeLoans.map((loan) => {
            const isOverdue = loan.status === 'OVERDUE';
            return (
              <div
                key={loan.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 px-2 rounded-lg transition-colors cursor-pointer"
                onClick={() => onSelectLoan(loan.id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {loan.name}
                    </span>
                    {isOverdue && (
                      <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 font-mono">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {loan.lender} · {loan.loanType} · {loan.interestRate}%{' '}
                    {loan.interestType === 'REDUCING_BALANCE' ? 'reducing' : 'flat'}
                  </div>
                </div>

                <div className="flex items-center gap-6 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-xs text-slate-600 dark:text-slate-300">Outstanding</div>
                    <div className="text-xs font-semibold font-mono text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(loan.outstandingPrincipal, settings.currencySymbol, settings.currency)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-600 dark:text-slate-300">Monthly EMI</div>
                    <div className="text-xs font-semibold font-mono text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(loan.emiAmount, settings.currencySymbol, settings.currency)}
                    </div>
                  </div>

                  <div className="text-right hidden md:block">
                    <div className="text-xs text-slate-600 dark:text-slate-300">Next Due</div>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {loan.nextEmiDate ? formatDate(loan.nextEmiDate, settings.dateFormat) : 'None'}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickPay(loan.id);
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Pay
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

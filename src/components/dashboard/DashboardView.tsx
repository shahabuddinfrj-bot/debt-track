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
  PiggyBank
} from 'lucide-react';
import { storageService } from '../../services/storage';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenAddLoan: () => void;
  onSelectLoan: (loanId: string) => void;
  onPayEmi: (loanId: string) => void;
  onLoadDemoData?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenAddLoan,
  onSelectLoan,
  onPayEmi,
  onLoadDemoData,
}) => {
  const settings = storageService.getSettings();
  const metrics = storageService.getDashboardMetrics();
  const overdueSummary = storageService.getOverdueSummary();
  const loans = storageService.getLoans(false);
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE');
  const closedLoans = loans.filter((l) => l.status === 'CLOSED' || l.status === 'FORECLOSED');

  // Deposits & Savings direct calculation
  const depositsList = typeof storageService.getDeposits === 'function' ? storageService.getDeposits() : [];
  const calculatedMonthlyDeposit = depositsList
    .filter((d: any) => (d.status === 'ACTIVE' || !d.status) && (d.type === 'RD' || d.accountType === 'RD'))
    .reduce((sum: number, d: any) => sum + Number(d.monthlyAmount || d.monthlyOutlay || d.monthlyDeposit || 0), 0);
  const calculatedActiveDepositsCount = depositsList.filter((d: any) => d.status === 'ACTIVE' || !d.status).length;
  const calculatedTotalDepositBalance = depositsList
    .filter((d: any) => d.status === 'ACTIVE' || !d.status)
    .reduce((sum: number, d: any) => sum + Number(d.currentBalance || d.totalDeposited || 0), 0);
  const calculatedTotalCommitment = (metrics.totalMonthlyEmi || 0) + (metrics.totalMonthlyDeposit || calculatedMonthlyDeposit);

  // Find loans finishing earliest and latest
  const sortedByClosure = [...activeLoans]
    .filter((l) => l.expectedClosureDate)
    .sort((a, b) => (a.expectedClosureDate || '').localeCompare(b.expectedClosureDate || ''));

  const earliestFinishingLoan = sortedByClosure[0] || null;
  const latestFinishingLoan = sortedByClosure[sortedByClosure.length - 1] || null;

  // Total EMIs remaining across active loans
  const totalEmisRemaining = activeLoans.reduce((sum, l) => sum + (l.emisRemaining || 0), 0);

  // If no loans at all, show friendly empty state
  if (loans.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mx-auto flex items-center justify-center mb-4">
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
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Your First Loan</span>
          </button>
          {onLoadDemoData && (
            <button
              onClick={onLoadDemoData}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              Load Sample Data
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overdue Banner (Prominent Alert) */}
      {overdueSummary.hasOverdue && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Action Required: Overdue Payments Detected</p>
              <p className="text-xs text-rose-600/80 dark:text-rose-400/80">
                You have {overdueSummary.count} overdue installment{overdueSummary.count > 1 ? 's' : ''}{' '}
                totaling {formatCurrency(overdueSummary.totalAmount, settings.currencySymbol, settings.currency)}.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('overdue')}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors shrink-0 shadow-sm flex items-center justify-center gap-1.5 self-start sm:self-auto"
          >
            <span>Resolve Overdue EMIs</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upcoming EMI Alert (if due within 3 days and not overdue) */}
      {!overdueSummary.hasOverdue && metrics.nextPaymentDue && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 shrink-0" />
            <p className="text-xs font-medium">
              <span className="font-bold">Upcoming EMI:</span> Next installment of{' '}
              <span className="font-mono font-bold">
                {formatCurrency(metrics.nextPaymentDue.amount, settings.currencySymbol, settings.currency)}
              </span>{' '}
              for {metrics.nextPaymentDue.loanName} is due{' '}
              <span className="font-semibold">{formatDate(metrics.nextPaymentDue.dueDate)}</span>.
            </p>
          </div>
          <button
            onClick={() => onPayEmi(metrics.nextPaymentDue!.loanId)}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors shrink-0 shadow-sm self-start sm:self-auto"
          >
            Mark Paid
          </button>
        </div>
      )}

      {/* Unified Monthly Financial Commitments */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white rounded-2xl shadow-md border border-slate-700/60 dark:border-slate-800">
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
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
          >
            <PiggyBank className="w-3.5 h-3.5" />
            <span>Manage Deposits</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-700/60">
          {/* Card 1: Total Loan EMI */}
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

          {/* Card 2: Total Deposit Contribution (Savings) */}
          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="text-[11px] text-emerald-400 font-medium uppercase tracking-wider">
              Total Deposit Contribution (Savings)
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(metrics.totalMonthlyDeposit || calculatedMonthlyDeposit, settings.currencySymbol, settings.currency)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.activeDepositsCount || calculatedActiveDepositsCount} recurring savings/RD plans
            </div>
          </div>

          {/* Card 3: Total Monthly Commitment */}
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
            <div className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
              Total Monthly Commitment
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
              {formatCurrency(metrics.totalMonthlyCommitment || calculatedTotalCommitment, settings.currencySymbol, settings.currency)}
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">
              Loan EMI + Deposit Contribution
            </div>
          </div>
        </div>
      </div>

      {/* Core KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Outstanding</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(metrics.totalOutstanding, settings.currencySymbol, settings.currency)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Across {metrics.activeLoansCount} active loans
          </p>
        </div>

        {/* Monthly EMI Commitment */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Monthly EMI Commitment</span>
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(metrics.totalMonthlyEmi, settings.currencySymbol, settings.currency)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics.emisDueThisMonth} EMIs due this month
          </p>
        </div>

        {/* Next EMI Due */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Next EMI Due</span>
            <Clock className="w-4 h-4" />
          </div>
          {metrics.nextPaymentDue ? (
            <>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
                {formatCurrency(metrics.nextPaymentDue.amount, settings.currencySymbol, settings.currency)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {formatDate(metrics.nextPaymentDue.dueDate)} · {metrics.nextPaymentDue.loanName}
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold font-mono text-slate-400">None</div>
              <p className="text-xs text-slate-500 mt-1">No upcoming payments</p>
            </>
          )}
        </div>

        {/* Overdue Amount */}
        <div
          className={`p-5 rounded-2xl border shadow-sm transition-colors ${
            overdueSummary.hasOverdue
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-300'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overdue Amount</span>
            <AlertTriangle
              className={`w-4 h-4 ${overdueSummary.hasOverdue ? 'text-rose-500' : 'text-slate-400'}`}
            />
          </div>
          <div
            className={`text-2xl font-bold font-mono tracking-tight ${
              overdueSummary.hasOverdue
                ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {formatCurrency(overdueSummary.totalAmount, settings.currencySymbol, settings.currency)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {overdueSummary.hasOverdue
              ? `${overdueSummary.count} missed payment${overdueSummary.count > 1 ? 's' : ''}`
              : 'No missed payments'}
          </p>
        </div>
      </div>

      {/* Principal Repayment Progress Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Principal Repayment Progress</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You have repaid {metrics.repaymentProgress}% of all borrowed capital.
            </p>
          </div>
          <div className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
            Repaid:{' '}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.totalPrincipalPaid, settings.currencySymbol, settings.currency)}
            </span>{' '}
            | Borrowed:{' '}
            <span className="font-bold">
              {formatCurrency(metrics.totalBorrowed, settings.currencySymbol, settings.currency)}
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, metrics.repaymentProgress))}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Principal Paid</div>
            <div className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {formatCurrency(metrics.totalPrincipalPaid, settings.currencySymbol, settings.currency)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Interest Paid to Date</div>
            <div className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {formatCurrency(metrics.totalInterestPaid, settings.currencySymbol, settings.currency)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Remaining Interest</div>
            <div className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {formatCurrency(metrics.totalRemainingInterest, settings.currencySymbol, settings.currency)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Remaining EMIs</div>
            <div className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {totalEmisRemaining} installments
            </div>
          </div>
        </div>
      </div>

      {/* Milestones & Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Milestone: First Loan to Finish */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">First Loan to Finish</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                Milestone
              </span>
            </div>
            {earliestFinishingLoan ? (
              <>
                <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {earliestFinishingLoan.bankName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {earliestFinishingLoan.loanName} · {earliestFinishingLoan.loanType}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">No active loans</p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Target Closure:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {earliestFinishingLoan?.expectedClosureDate ? formatDate(earliestFinishingLoan.expectedClosureDate) : '—'}
            </span>
          </div>
        </div>

        {/* Milestone: Last Loan to Finish */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Last Loan to Finish</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                Long-term
              </span>
            </div>
            {latestFinishingLoan ? (
              <>
                <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {latestFinishingLoan.bankName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {latestFinishingLoan.loanName} · {latestFinishingLoan.loanType}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">No active loans</p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Debt-Free Date:</span>
            <span className="font-bold text-slate-900 dark:text-white font-mono">
              {latestFinishingLoan?.expectedClosureDate ? formatDate(latestFinishingLoan.expectedClosureDate) : '—'}
            </span>
          </div>
        </div>

        {/* Portfolio Status Summary */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Portfolio Status</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                Summary
              </span>
            </div>
            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Active Loans</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{activeLoans.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Closed/Settled</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{closedLoans.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Total Borrowed Records</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{loans.length}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => onNavigate('loans')}
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <span>View all loan records</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

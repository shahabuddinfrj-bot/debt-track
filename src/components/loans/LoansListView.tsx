import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  ArrowUpDown,
  CreditCard,
  Building,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Archive,
} from 'lucide-react';
import { Loan, LoanStatus, LoanType, UserSettings } from '../../types/loan';
import { storageService } from '../../services/storage';
import { formatCurrency, formatDate, formatMonthYear } from '../../utils/formatters';

interface LoansListViewProps {
  settings: UserSettings;
  onOpenAddLoan: () => void;
  onSelectLoan: (loanId: string) => void;
  onQuickPay: (loanId: string) => void;
}

export const LoansListView: React.FC<LoansListViewProps> = ({
  settings,
  onOpenAddLoan,
  onSelectLoan,
  onQuickPay,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LoanStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [lenderFilter, setLenderFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'OUTSTANDING_DESC' | 'EMI_DESC' | 'DUE_DATE' | 'NAME'>('OUTSTANDING_DESC');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 30);
    return () => clearTimeout(timer);
  }, [statusFilter, typeFilter, lenderFilter, searchQuery, sortBy, viewMode]);

  const allLoans = storageService.getLoans(false);

  // Extract distinct lenders & types for filters
  const lenders = useMemo(() => {
    const set = new Set<string>();
    allLoans.forEach((l) => {
      if (l.lender) set.add(l.lender);
    });
    return Array.from(set).sort();
  }, [allLoans]);

  const loanTypes = useMemo(() => {
    const set = new Set<string>();
    allLoans.forEach((l) => {
      if (l.loanType) set.add(l.loanType);
    });
    return Array.from(set).sort();
  }, [allLoans]);

  // Filtered and sorted loans
  const filteredLoans = useMemo(() => {
    return allLoans
      .filter((loan) => {
        // Status filter
        if (statusFilter !== 'ALL' && loan.status !== statusFilter) {
          return false;
        }

        // Type filter
        if (typeFilter !== 'ALL' && loan.loanType !== typeFilter) {
          return false;
        }

        // Lender filter
        if (lenderFilter !== 'ALL' && loan.lender !== lenderFilter) {
          return false;
        }

        // Search text
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = loan.name.toLowerCase().includes(q);
          const matchesLender = loan.lender.toLowerCase().includes(q);
          const matchesAccount = loan.accountNumber.toLowerCase().includes(q);
          const matchesType = loan.loanType.toLowerCase().includes(q);
          const matchesNotes = loan.notes?.toLowerCase().includes(q);
          if (!matchesName && !matchesLender && !matchesAccount && !matchesType && !matchesNotes) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'OUTSTANDING_DESC') {
          return b.outstandingPrincipal - a.outstandingPrincipal;
        }
        if (sortBy === 'EMI_DESC') {
          return b.emiAmount - a.emiAmount;
        }
        if (sortBy === 'DUE_DATE') {
          return (a.nextEmiDate || '9999').localeCompare(b.nextEmiDate || '9999');
        }
        return a.name.localeCompare(b.name);
      });
  }, [allLoans, statusFilter, typeFilter, lenderFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Loans
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Manage your personal loans, mortgages, vehicle loans, and credit lines.
          </p>
        </div>

        <button
          onClick={onOpenAddLoan}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Loan</span>
        </button>
      </div>

      {/* Controls Bar: Search, Filters & View Toggle */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-600 dark:text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by loan name, bank, account number, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400"
            />
          </div>

          {/* View Toggles & Sorting */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="OUTSTANDING_DESC">Highest Outstanding</option>
              <option value="EMI_DESC">Highest Monthly EMI</option>
              <option value="DUE_DATE">Nearest Due Date</option>
              <option value="NAME">Loan Name (A-Z)</option>
            </select>

            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                title="Table View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded text-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
            {(['ALL', 'ACTIVE', 'OVERDUE', 'CLOSED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All Loans' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Lender Dropdown Filter */}
          {lenders.length > 0 && (
            <select
              value={lenderFilter}
              onChange={(e) => setLenderFilter(e.target.value)}
              className="py-1 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-[11px]"
            >
              <option value="ALL">All Lenders</option>
              {lenders.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}

          {/* Loan Type Dropdown Filter */}
          {loanTypes.length > 0 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="py-1 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-[11px]"
            >
              <option value="ALL">All Types</option>
              {loanTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {(statusFilter !== 'ALL' || typeFilter !== 'ALL' || lenderFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setLenderFilter('ALL');
                setSearchQuery('');
              }}
              className="text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Loans Display (Empty State vs Table vs Grid) */}
      {filteredLoans.length === 0 ? (
        <div className={`p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-all duration-500 ease-out transform ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            No matching loans found
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
            Try adjusting your search query or active filter settings.
          </p>
          <button
            onClick={onOpenAddLoan}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            Add New Loan
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="py-3 px-4">Loan Details</th>
                  <th className="py-3 px-4">Type & Lender</th>
                  <th className="py-3 px-4 text-right">Original Amount</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-right">Monthly EMI</th>
                  <th className="py-3 px-4 text-center">Progress</th>
                  <th className="py-3 px-4">Next Due Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLoans.map((loan, index) => {
                  const progressPct =
                    loan.originalAmount > 0
                      ? Math.min(100, Math.round(((loan.originalAmount - loan.outstandingPrincipal) / loan.originalAmount) * 100))
                      : 0;
                  return (
                    <tr
                      key={loan.id}
                      onClick={() => onSelectLoan(loan.id)}
                      style={{
                        transitionDelay: `${Math.min(index * 35, 280)}ms`,
                      }}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/30 cursor-pointer transition-all duration-300 ease-out transform ${
                        isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white max-w-[200px]">
                        <div className="truncate font-semibold">{loan.name}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                          {loan.accountNumber || 'No ref #'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        <div>{loan.loanType}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">{loan.lender}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(loan.originalAmount, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(loan.outstandingPrincipal, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(loan.emiAmount, settings.currencySymbol, settings.currency)}
                        <span className="block text-[10px] text-slate-600 dark:text-slate-300 font-normal">
                          {loan.interestRate}% {loan.interestType === 'REDUCING_BALANCE' ? 'red.' : 'flat'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          <span>{progressPct}%</span>
                        </div>
                        <div className="w-16 mx-auto bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {loan.nextEmiDate ? formatDate(loan.nextEmiDate, settings.dateFormat) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block text-[10px] font-mono font-semibold ${
                            loan.status === 'OVERDUE'
                              ? 'text-rose-600 dark:text-rose-400'
                              : loan.status === 'CLOSED'
                              ? 'text-slate-600 dark:text-slate-300'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {loan.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {loan.status !== 'CLOSED' && (
                            <button
                              onClick={() => onQuickPay(loan.id)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => onSelectLoan(loan.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-900 dark:text-white hover:underline"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLoans.map((loan, index) => {
            const isOverdue = loan.status === 'OVERDUE';
            const isClosed = loan.status === 'CLOSED';
            const progressPct =
              loan.originalAmount > 0
                ? Math.min(100, Math.round(((loan.originalAmount - loan.outstandingPrincipal) / loan.originalAmount) * 100))
                : 0;

            return (
              <div
                key={loan.id}
                onClick={() => onSelectLoan(loan.id)}
                style={{
                  transitionDelay: `${Math.min(index * 60, 480)}ms`,
                }}
                className={`p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-1 cursor-pointer flex flex-col justify-between transition-all duration-500 ease-out transform ${
                  isLoaded
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-4 scale-[0.98]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {loan.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {loan.lender} · {loan.loanType}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-semibold ${
                        isOverdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : isClosed
                          ? 'text-slate-600 dark:text-slate-300'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {loan.status}
                    </span>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs">
                    <div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Outstanding
                      </div>
                      <div className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(loan.outstandingPrincipal, settings.currencySymbol, settings.currency)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Monthly EMI
                      </div>
                      <div className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(loan.emiAmount, settings.currencySymbol, settings.currency)}
                      </div>
                    </div>
                  </div>

                  {/* Repayment Progress bar */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                      <span>{loan.emisPaid} paid / {loan.totalEmis} total</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer details & quick action */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                    {loan.nextEmiDate ? (
                      <>Due: {formatDate(loan.nextEmiDate, settings.dateFormat)}</>
                    ) : (
                      <>Paid in full</>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {!isClosed && (
                      <button
                        onClick={() => onQuickPay(loan.id)}
                        className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Pay
                      </button>
                    )}
                    <button
                      onClick={() => onSelectLoan(loan.id)}
                      className="text-xs font-semibold text-slate-900 dark:text-white hover:underline flex items-center gap-0.5"
                    >
                      <span>Manage</span>
                      <ChevronRight className="w-3 h-3" />
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

import React, { useState, useEffect } from 'react';

export interface LoanItem {
  id: string;
  name: string;
  lender: string;
  type: string;
  status: 'ACTIVE' | 'CLOSED' | 'OVERDUE';
  outstanding: number;
  monthlyEmi: number;
  paidTenure: number;
  totalTenure: number;
  nextDueDate: string;
}

interface LoansListViewProps {
  loans?: LoanItem[];
  settings?: any;
  onOpenAddLoan?: () => void;
  onSelectLoan: (loanId: string) => void;
  onQuickPay?: (loanId: string) => void;
}

export const LoansListView: React.FC<LoansListViewProps> = ({
  loans = [],
  settings,
  onOpenAddLoan,
  onSelectLoan,
  onQuickPay,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'CLOSED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [lenderFilter, setLenderFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'OUTSTANDING_DESC' | 'EMI_DESC' | 'DUE_DATE' | 'NAME'>('OUTSTANDING_DESC');

  // LocalStorage se viewMode read karein taaki data polling/refresh par reset na ho
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('debt_track_view_mode');
      return saved === 'table' ? 'table' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleViewChange = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('debt_track_view_mode', mode);
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered & Sorted Loans
  const filteredLoans = loans.filter((loan) => {
    const matchesSearch =
      loan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.lender.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || loan.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || loan.type === typeFilter;
    const matchesLender = lenderFilter === 'ALL' || loan.lender === lenderFilter;
    return matchesSearch && matchesStatus && matchesType && matchesLender;
  });

  const sortedLoans = [...filteredLoans].sort((a, b) => {
    if (sortBy === 'OUTSTANDING_DESC') return b.outstanding - a.outstanding;
    if (sortBy === 'EMI_DESC') return b.monthlyEmi - a.monthlyEmi;
    if (sortBy === 'NAME') return a.name.localeCompare(b.name);
    return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
  });

  return (
    <div className="w-full text-slate-200">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="Search by loan name, bank, account number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161c28] border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-[#161c28] border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none"
            >
              <option value="OUTSTANDING_DESC">Highest Outstanding</option>
              <option value="EMI_DESC">Highest EMI</option>
              <option value="DUE_DATE">Nearest Due Date</option>
              <option value="NAME">Name (A-Z)</option>
            </select>

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center bg-[#161c28] border border-slate-700/60 rounded-xl p-1">
              <button
                type="button"
                onClick={() => handleViewChange('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Table View"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => handleViewChange('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid View"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M4 4h7v7H4zm9 0h7v7h-7zm0 9h7v7h-7zm-9 0h7v7H4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'ACTIVE', 'OVERDUE', 'CLOSED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-[#161c28] text-slate-400 border border-slate-700/40'
              }`}
            >
              {st === 'ALL' ? 'All Loans' : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedLoans.map((loan) => {
            const progress = loan.totalTenure ? Math.round((loan.paidTenure / loan.totalTenure) * 100) : 0;
            return (
              <div
                key={loan.id}
                onClick={() => onSelectLoan(loan.id)}
                className="bg-[#121824] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all cursor-pointer shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white text-base">{loan.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{loan.lender} • {loan.type}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      {loan.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-5">
                    <div>
                      <p className="text-[11px] tracking-wider text-slate-400 font-medium">OUTSTANDING</p>
                      <p className="text-lg font-bold text-white mt-0.5">₹{loan.outstanding.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-[11px] tracking-wider text-slate-400 font-medium">MONTHLY EMI</p>
                      <p className="text-lg font-bold text-white mt-0.5">₹{loan.monthlyEmi.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{loan.paidTenure} paid / {loan.totalTenure} total</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-cyan-500 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <span className="text-xs text-slate-400">Due: {loan.nextDueDate}</span>
                  <div className="flex items-center gap-2">
                    {onQuickPay && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickPay(loan.id);
                        }}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded"
                      >
                        Pay
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLoan(loan.id);
                      }}
                      className="text-xs font-medium text-slate-300 hover:text-white px-2 py-1 rounded flex items-center gap-0.5"
                    >
                      Manage &gt;
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#121824] border border-slate-800 rounded-2xl overflow-x-auto shadow-lg">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-[#161c28] text-xs text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Loan / Lender</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Outstanding</th>
                <th className="py-3 px-4">Monthly EMI</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedLoans.map((loan) => (
                <tr
                  key={loan.id}
                  onClick={() => onSelectLoan(loan.id)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-white">{loan.name}</div>
                    <div className="text-xs text-slate-400">{loan.lender}</div>
                  </td>
                  <td className="py-3.5 px-4 text-xs">{loan.type}</td>
                  <td className="py-3.5 px-4 font-semibold text-white">₹{loan.outstanding.toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-4 font-semibold text-white">₹{loan.monthlyEmi.toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-4 text-xs">{loan.paidTenure} / {loan.totalTenure} paid</td>
                  <td className="py-3.5 px-4">
                    <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {loan.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLoan(loan.id);
                      }}
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LoansListView;

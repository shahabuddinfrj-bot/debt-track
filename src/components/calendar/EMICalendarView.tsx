import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { EMIScheduleItem, Loan, UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate, getDaysDifference } from '../../utils/formatters';

interface EMICalendarViewProps {
  settings: UserSettings;
  onQuickPay: (loanId: string, emiPaymentNo?: number) => void;
  onSelectLoan: (loanId: string) => void;
}

export const EMICalendarView: React.FC<EMICalendarViewProps> = ({
  settings,
  onQuickPay,
  onSelectLoan,
}) => {
  // Current calendar view month/year
  const [currentDate, setCurrentDate] = useState(() => {
    const [y, m] = CURRENT_DATE_STR.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  const [selectedLender, setSelectedLender] = useState<string>('ALL');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loans = storageService.getLoans(false);

  const lenders = useMemo(() => {
    const set = new Set<string>();
    loans.forEach((l) => {
      if (l.lender) set.add(l.lender);
    });
    return Array.from(set).sort();
  }, [loans]);

  // Aggregate all EMIs across all loans
  const allEvents = useMemo(() => {
    const list: {
      loanId: string;
      loanName: string;
      lender: string;
      paymentNo: number;
      dueDate: string;
      amount: number;
      paidAmount: number;
      status: string;
      isDueToday: boolean;
      isOverdue: boolean;
    }[] = [];

    loans.forEach((loan) => {
      if (selectedLoanId !== 'ALL' && loan.id !== selectedLoanId) return;
      if (selectedLender !== 'ALL' && loan.lender !== selectedLender) return;

      const schedule = storageService.getSchedule(loan.id);
      schedule.forEach((item) => {
        const diff = getDaysDifference(item.dueDate, CURRENT_DATE_STR);
        const isOverdue = item.status === 'OVERDUE' || (item.status === 'PENDING' && diff < 0);
        const isDueToday = diff === 0;

        let derivedStatus = item.status;
        if (isOverdue && item.status !== 'PAID') derivedStatus = 'OVERDUE';

        if (statusFilter !== 'ALL') {
          if (statusFilter === 'PAID' && item.status !== 'PAID') return;
          if (statusFilter === 'PENDING' && item.status !== 'PENDING') return;
          if (statusFilter === 'OVERDUE' && !isOverdue) return;
        }

        list.push({
          loanId: loan.id,
          loanName: loan.name,
          lender: loan.lender,
          paymentNo: item.paymentNo,
          dueDate: item.dueDate,
          amount: item.emiAmount,
          paidAmount: item.paidAmount || 0,
          status: derivedStatus,
          isDueToday,
          isOverdue,
        });
      });
    });

    return list;
  }, [loans, selectedLoanId, selectedLender, statusFilter]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Calendar matrix calculation
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const resetToCurrent = () => {
    const [y, m] = CURRENT_DATE_STR.split('-').map(Number);
    setCurrentDate(new Date(y, m - 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            EMI Calendar
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            Visualize your scheduled debt installments and track monthly payment milestones.
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={resetToCurrent}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Current Month
          </button>
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 shadow-xs">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold font-mono text-slate-900 dark:text-white whitespace-nowrap">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center gap-3 text-xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
          {(['ALL', 'PENDING', 'PAID', 'OVERDUE'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Lender Filter */}
        {lenders.length > 0 && (
          <select
            value={selectedLender}
            onChange={(e) => setSelectedLender(e.target.value)}
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

        {/* Loan Filter */}
        <select
          value={selectedLoanId}
          onChange={(e) => setSelectedLoanId(e.target.value)}
          className="py-1 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-[11px] max-w-[200px] truncate"
        >
          <option value="ALL">All Loans</option>
          {loans.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        {/* Legend */}
        <div className="flex items-center gap-3 ml-auto text-[11px] font-mono text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Paid
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Upcoming
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Due Today
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Overdue
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 py-2.5">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
            <div
              key={`empty_${idx}`}
              className="min-h-[100px] bg-slate-50/40 dark:bg-slate-950/20 p-2"
            />
          ))}

          {/* Actual Month Days */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isToday = dateStr === CURRENT_DATE_STR;

            // Events on this day
            const dayEvents = allEvents.filter((ev) => ev.dueDate === dateStr);

            return (
              <div
                key={`day_${dayNum}`}
                className={`min-h-[100px] p-2 transition-colors flex flex-col justify-between ${
                  isToday ? 'bg-amber-50/30 dark:bg-amber-950/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-mono font-semibold ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-[11px]'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300">
                      {dayEvents.length} EMI{dayEvents.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Day events stack */}
                <div className="space-y-1 overflow-y-auto max-h-[80px]">
                  {dayEvents.map((ev, eIdx) => {
                    const isPaid = ev.status === 'PAID';
                    const isOverdue = ev.status === 'OVERDUE';
                    const isTodayDue = ev.isDueToday && !isPaid;

                    return (
                      <div
                        key={`${ev.loanId}_${ev.paymentNo}_${eIdx}`}
                        onClick={() => onQuickPay(ev.loanId, ev.paymentNo)}
                        className={`p-1 rounded text-[10px] cursor-pointer transition-transform hover:scale-[1.02] border ${
                          isPaid
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200'
                            : isOverdue
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-200'
                            : isTodayDue
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                        }`}
                        title={`${ev.loanName} - Click to Pay or View`}
                      >
                        <div className="font-semibold truncate">{ev.loanName}</div>
                        <div className="flex items-center justify-between font-mono font-medium">
                          <span>
                            {formatCurrency(ev.amount, settings.currencySymbol, settings.currency)}
                          </span>
                          <span className="text-[9px] uppercase">{ev.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

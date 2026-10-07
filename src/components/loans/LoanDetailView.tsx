import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Download,
  Edit2,
  FileText,
  History,
  Info,
  Layers,
  Lock,
  MessageSquare,
  Paperclip,
  Percent,
  Plus,
  Printer,
  ShieldCheck,
  TrendingDown,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  EMIScheduleItem,
  Loan,
  LoanDocument,
  LoanNote,
  UserSettings,
} from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import {
  formatCurrency,
  formatDate,
  formatMonthYear,
  getRelativeDueDateText,
} from '../../utils/formatters';

interface LoanDetailViewProps {
  loanId: string;
  settings: UserSettings;
  onBack: () => void;
  onEditLoan: (loan: Loan) => void;
  onRecordPayment: (loanId: string, emiPaymentNo?: number) => void;
  onPrepayment: (loanId: string) => void;
  onOpenStatement: (loanId: string) => void;
  refreshTrigger: number;
}

export const LoanDetailView: React.FC<LoanDetailViewProps> = ({
  loanId,
  settings,
  onBack,
  onEditLoan,
  onRecordPayment,
  onPrepayment,
  onOpenStatement,
  refreshTrigger,
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'history' | 'documents' | 'notes' | 'audit'>('schedule');
  const [newNoteText, setNewNoteText] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState<LoanDocument['type']>('Loan Agreement');
  const [newDocNotes, setNewDocNotes] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<string>('ALL');
  const [localRefresh, setLocalRefresh] = useState(0);

  const loan = storageService.getLoanById(loanId);
  const schedule = storageService.getSchedule(loanId);
  const documents = storageService.getDocuments(loanId);
  const notes = storageService.getNotes(loanId);
  const allAudit = storageService.getAuditLogs();
  const loanAudit = allAudit.filter(
    (a) => a.entityId === loanId || (loan && a.details.includes(loan.name))
  );

  if (!loan) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-sm text-slate-500 mb-4">Loan not found or was removed.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg"
        >
          Back to Loans
        </button>
      </div>
    );
  }

  // Handle Undo / Revert Payment
  const handleUndoPayment = (paymentNo: number) => {
    const confirmUndo = window.confirm(
      `Kya aap Installment #${paymentNo} ke payment ko undo/cancel karke wapas UNPAID karna chahte hain?`
    );
    if (confirmUndo) {
      const res = storageService.undoPayment(loan.id, paymentNo);
      if (res.success) {
        setLocalRefresh((prev) => prev + 1);
      } else {
        alert(res.error || 'Failed to undo payment');
      }
    }
  };

  // Flatten payment transactions from schedule
  const paymentHistory = schedule.flatMap((item) =>
    (item.payments || []).map((pay) => ({
      ...pay,
      paymentNo: item.paymentNo,
      scheduledDueDate: item.dueDate,
    }))
  ).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  const progressPct =
    loan.originalAmount > 0
      ? Math.min(100, Math.round(((loan.originalAmount - loan.outstandingPrincipal) / loan.originalAmount) * 100))
      : 0;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    storageService.addNote(loan.id, newNoteText.trim());
    setNewNoteText('');
  };

  const handleUploadDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;

    const doc: LoanDocument = {
      id: 'doc_' + Date.now(),
      loanId: loan.id,
      name: newDocName.trim(),
      type: newDocType,
      uploadDate: CURRENT_DATE_STR,
      notes: newDocNotes.trim() || undefined,
      fileSize: '1.2 MB',
    };

    storageService.saveDocument(doc);
    setNewDocName('');
    setNewDocNotes('');
    setShowUploadModal(false);
  };

  const handleDeleteDocument = (docId: string) => {
    if (window.confirm('Are you sure you want to delete this document attachment?')) {
      storageService.deleteDocument(docId);
    }
  };

  const handleCloseLoan = () => {
    const confirmReason = window.prompt(
      'Are you sure you want to close this loan? Enter closure remarks (optional):',
      'Fully settled and closed'
    );
    if (confirmReason !== null) {
      storageService.closeLoan(loan.id, CURRENT_DATE_STR, confirmReason);
    }
  };

  const handleReopenLoan = () => {
    if (window.confirm('Do you want to re-open this loan as active?')) {
      storageService.reopenLoan(loan.id);
    }
  };

  // Filter schedule
  const filteredSchedule = schedule.filter((item) => {
    if (scheduleStatusFilter !== 'ALL' && item.status !== scheduleStatusFilter) {
      return false;
    }
    if (scheduleSearch.trim()) {
      const q = scheduleSearch.toLowerCase();
      const matchesNo = item.paymentNo.toString().includes(q);
      const matchesDate = item.dueDate.includes(q);
      const matchesNotes = item.notes?.toLowerCase().includes(q);
      if (!matchesNo && !matchesDate && !matchesNotes) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full max-w-full">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Loans</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {loan.status !== 'CLOSED' ? (
            <>
              <button
                onClick={() => onRecordPayment(loan.id)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
              >
                Record Payment
              </button>
              <button
                onClick={() => onPrepayment(loan.id)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Prepayment
              </button>
              <button
                onClick={handleCloseLoan}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Close Loan
              </button>
            </>
          ) : (
            <button
              onClick={handleReopenLoan}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Reopen Loan
            </button>
          )}

          <button
            onClick={() => onOpenStatement(loan.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Statement</span>
          </button>

          <button
            onClick={() => onEditLoan(loan)}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Edit Loan"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Loan Header Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {loan.name}
              </h1>
              <span
                className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                  loan.status === 'OVERDUE'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : loan.status === 'CLOSED'
                    ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {loan.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mt-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{loan.lender}</span>
              <span>·</span>
              <span>{loan.loanType}</span>
              <span>·</span>
              <span className="font-mono">Acct: {loan.accountNumber || 'N/A'}</span>
              <span>·</span>
              <span>Calc Source: {loan.calculationSource}</span>
            </div>
            {loan.notes && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 italic">
                "{loan.notes}"
              </p>
            )}
          </div>

          {/* Next Due Highlight Box */}
          {loan.status !== 'CLOSED' && loan.nextEmiDate && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs md:text-right shrink-0">
              <div className="text-[11px] text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
                Next Installment
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(loan.nextEmiAmount, settings.currencySymbol, settings.currency)}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                Due on {formatDate(loan.nextEmiDate, settings.dateFormat)} (
                {getRelativeDueDateText(loan.nextEmiDate, CURRENT_DATE_STR).text})
              </div>
            </div>
          )}
        </div>

        {/* Financial Metric Blocks */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6 text-xs">
          <div>
            <div className="text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
              Outstanding Principal
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {formatCurrency(loan.outstandingPrincipal, settings.currencySymbol, settings.currency)}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              of {formatCurrency(loan.originalAmount, settings.currencySymbol, settings.currency)}
            </div>
          </div>

          <div>
            <div className="text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
              Monthly EMI
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {formatCurrency(loan.emiAmount, settings.currencySymbol, settings.currency)}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              Due on day {loan.emiDueDay} of month
            </div>
          </div>

          <div>
            <div className="text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
              Interest Rate
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {loan.interestRate}%
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              {loan.interestType === 'REDUCING_BALANCE'
                ? 'Reducing Balance'
                : loan.interestType === 'FLAT_RATE'
                ? 'Flat Rate'
                : 'Interest Only'}
            </div>
          </div>

          <div>
            <div className="text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
              EMIs Paid / Remaining
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {loan.emisPaid} / {loan.emisRemaining}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              Total {loan.totalEmis} installments
            </div>
          </div>

          <div>
            <div className="text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px]">
              Expected Closure
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
              {formatMonthYear(loan.expectedClosureDate)}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              Started {formatDate(loan.startDate, settings.dateFormat)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs mb-2 font-mono">
            <span className="text-slate-600 dark:text-slate-300">
              Principal Repaid: {progressPct}% ({formatCurrency(loan.totalPrincipalPaid, settings.currencySymbol, settings.currency)})
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              Total Interest Paid: {formatCurrency(loan.totalInterestPaid, settings.currencySymbol, settings.currency)}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="w-full max-w-full flex overflow-x-auto no-scrollbar whitespace-nowrap gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 transition-colors flex items-center gap-1.5 ${
            activeTab === 'schedule'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <span>Amortization Schedule</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'schedule'
                ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            ({schedule.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 transition-colors flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <span>Payment History</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'history'
                ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            ({paymentHistory.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 transition-colors flex items-center gap-1.5 ${
            activeTab === 'documents'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <span>Documents</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'documents'
                ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            ({documents.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 transition-colors flex items-center gap-1.5 ${
            activeTab === 'notes'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <span>Notes</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'notes'
                ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            ({notes.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 transition-colors flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <span>Audit History</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'audit'
                ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            ({loanAudit.length})
          </span>
        </button>
      </div>

      {/* Tab 1: Amortization Schedule */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search installment # or date..."
                value={scheduleSearch}
                onChange={(e) => setScheduleSearch(e.target.value)}
                className="py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs"
              />
              <select
                value={scheduleStatusFilter}
                onChange={(e) => setScheduleStatusFilter(e.target.value)}
                className="py-1.5 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>

            <div className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              Showing {filteredSchedule.length} of {schedule.length} installments
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 text-center">#</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Opening Principal</th>
                    <th className="py-2.5 px-3 text-right">EMI Amount</th>
                    <th className="py-2.5 px-3 text-right">Interest</th>
                    <th className="py-2.5 px-3 text-right">Principal</th>
                    <th className="py-2.5 px-3 text-right">Closing Principal</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSchedule.map((item) => (
                    <tr
                      key={item.paymentNo}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 font-mono"
                    >
                      <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-300">
                        {item.paymentNo}
                      </td>
                      <td className="py-2 px-3 text-slate-900 dark:text-white">
                        {formatDate(item.dueDate, settings.dateFormat)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(item.openingPrincipal, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(item.emiAmount, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                        {formatCurrency(item.interestComponent, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(item.principalComponent, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(item.closingPrincipal, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`text-[10px] font-semibold ${
                            item.status === 'PAID'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : item.status === 'OVERDUE'
                              ? 'text-rose-600 dark:text-rose-400'
                              : item.status === 'PARTIAL'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        {item.status !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() => onRecordPayment(loan.id, item.paymentNo)}
                            className="px-2 py-0.5 text-[11px] font-medium text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            Pay
                          </button>
                        )}
                        {item.status === 'PAID' && (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[11px] text-slate-500">
                              {formatDate(item.actualPaymentDate, settings.dateFormat)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUndoPayment(item.paymentNo)}
                              title="Undo payment / Reset to Unpaid"
                              className="px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Undo</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Payment History */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {paymentHistory.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600 dark:text-slate-300">
              No payment transactions recorded yet for this loan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">EMI #</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Reference / Txn ID</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paymentHistory.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 font-mono">
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {formatDate(pay.paymentDate, settings.dateFormat)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        Installment #{pay.paymentNo}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(pay.amountPaid, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-sans">
                        {pay.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {pay.transactionRef || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-sans italic">
                        {pay.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleUndoPayment(pay.paymentNo)}
                          className="px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          Undo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Documents Management */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
              Attached Loan Documents & Contracts
            </h3>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Attach Document</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                No documents uploaded yet. Keep loan agreements, sanction letters, NOCs, and statements organized here.
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white truncate">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate">{doc.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                      {doc.type} · {formatDate(doc.uploadDate, settings.dateFormat)}
                      {doc.fileSize && ` · ${doc.fileSize}`}
                    </div>
                    {doc.notes && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 italic line-clamp-2">
                        {doc.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {showUploadModal && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full text-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">
                    Attach Loan Document
                  </span>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleUploadDocument} className="space-y-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Document Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Loan_Agreement_Signed.pdf"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Document Category
                    </label>
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="Loan Agreement">Loan Agreement</option>
                      <option value="Sanction Letter">Sanction Letter</option>
                      <option value="Statement">Statement</option>
                      <option value="Repayment Schedule">Repayment Schedule</option>
                      <option value="Insurance">Insurance Policy</option>
                      <option value="NOC">NOC / No Due Certificate</option>
                      <option value="Closure Letter">Closure Letter</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Notes / Remarks (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Notes about sanction terms, reference id, or expiry date..."
                      value={newDocNotes}
                      onChange={(e) => setNewDocNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-lg"
                    >
                      Save Document
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              placeholder="Add a personal note or reminder for this loan..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="flex-1 px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg whitespace-nowrap"
            >
              Add Note
            </button>
          </form>

          <div className="space-y-2">
            {notes.length === 0 ? (
              <div className="p-6 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                No personal notes added yet.
              </div>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                >
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{n.text}</p>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 font-mono">
                    {new Date(n.createdAt).toLocaleDateString()} at{' '}
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Audit History */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs">
          <div className="space-y-3">
            {loanAudit.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-300 py-4 text-center">
                No audit events recorded for this loan.
              </p>
            ) : (
              loanAudit.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-4 pb-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white font-mono text-[11px]">
                      {log.action}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">{log.details}</div>
                  </div>
                  <div className="text-right text-[11px] font-mono text-slate-600 dark:text-slate-300 shrink-0">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanDetailView;

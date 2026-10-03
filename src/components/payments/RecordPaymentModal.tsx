import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, CreditCard, DollarSign } from 'lucide-react';
import {
  EMIScheduleItem,
  Loan,
  PaymentMethod,
  UserSettings,
} from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface RecordPaymentModalProps {
  loanId: string | null;
  targetPaymentNo?: number;
  settings: UserSettings;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  loanId,
  targetPaymentNo,
  settings,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedLoanId, setSelectedLoanId] = useState<string>(loanId || '');
  const [paymentNo, setPaymentNo] = useState<number>(targetPaymentNo || 1);
  const [paymentDate, setPaymentDate] = useState<string>(CURRENT_DATE_STR);
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Auto Debit');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'FULL' | 'PARTIAL'>('FULL');

  const loans = storageService.getLoans(false).filter((l) => l.status !== 'CLOSED');

  useEffect(() => {
    if (loanId) {
      setSelectedLoanId(loanId);
    } else if (loans.length > 0 && !selectedLoanId) {
      setSelectedLoanId(loans[0].id);
    }
  }, [loanId, loans]);

  // Fetch schedule for currently selected loan
  const currentLoan = selectedLoanId ? storageService.getLoanById(selectedLoanId) : null;
  const schedule = selectedLoanId ? storageService.getSchedule(selectedLoanId) : [];

  // Find first unpaid / overdue or targeted installment
  useEffect(() => {
    if (schedule.length > 0) {
      let targetItem: EMIScheduleItem | undefined;
      if (targetPaymentNo) {
        targetItem = schedule.find((s) => s.paymentNo === targetPaymentNo);
      }
      if (!targetItem) {
        targetItem = schedule.find((s) => s.status !== 'PAID') || schedule[0];
      }

      if (targetItem) {
        setPaymentNo(targetItem.paymentNo);
        const remainingToPay = targetItem.emiAmount - (targetItem.paidAmount || 0);
        setAmountPaid(remainingToPay > 0 ? remainingToPay.toFixed(2) : '');
        if (targetItem.paidAmount > 0) {
          setPaymentType('PARTIAL');
        } else {
          setPaymentType('FULL');
        }
      }
    }
  }, [selectedLoanId, targetPaymentNo, schedule.length]);

  if (!isOpen) return null;

  const currentItem = schedule.find((s) => s.paymentNo === paymentNo);
  const scheduledAmount = currentItem ? currentItem.emiAmount : 0;
  const alreadyPaid = currentItem ? (currentItem.paidAmount || 0) : 0;
  const balanceDue = Math.max(0, scheduledAmount - alreadyPaid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amountPaid) || 0;

    if (!selectedLoanId) {
      alert('Please select a loan.');
      return;
    }
    if (numAmount <= 0) {
      alert('Please enter a payment amount greater than zero.');
      return;
    }
    if (!paymentDate) {
      alert('Please enter the payment date.');
      return;
    }

    // Apportion payment into interest and principal components
    const interestDue = currentItem ? currentItem.interestComponent : 0;
    const interestPart = Math.min(numAmount, interestDue);
    const principalPart = Math.max(0, numAmount - interestPart);

    const result = storageService.recordPayment(selectedLoanId, paymentNo, {
      paymentDate,
      amountPaid: numAmount,
      principalComponent: Number(principalPart.toFixed(2)),
      interestComponent: Number(interestPart.toFixed(2)),
      paymentMethod,
      transactionRef: transactionRef.trim() || `TXN-${Date.now().toString().slice(-6)}`,
      notes: notes.trim() || undefined,
    });

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      alert(result.error || 'Failed to record payment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-5 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Record EMI Payment
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Log an installment transaction to update your outstanding debt balance.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Loan Selector (if not locked to one) */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Loan *
            </label>
            <select
              value={selectedLoanId}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            >
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.lender}) - Outstanding:{' '}
                  {formatCurrency(l.outstandingPrincipal, settings.currencySymbol, settings.currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Installment Selector & Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Installment No. *
              </label>
              <select
                value={paymentNo}
                onChange={(e) => {
                  const no = Number(e.target.value);
                  setPaymentNo(no);
                  const item = schedule.find((s) => s.paymentNo === no);
                  if (item) {
                    const due = item.emiAmount - (item.paidAmount || 0);
                    setAmountPaid(due > 0 ? due.toFixed(2) : '');
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              >
                {schedule.map((s) => (
                  <option key={s.paymentNo} value={s.paymentNo}>
                    #{s.paymentNo} · Due: {formatDate(s.dueDate, settings.dateFormat)} ({s.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Installment Summary Banner */}
          {currentItem && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1">
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-600 dark:text-slate-300">Scheduled EMI:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(scheduledAmount, settings.currencySymbol, settings.currency)}
                </span>
              </div>
              {alreadyPaid > 0 && (
                <div className="flex items-center justify-between font-mono text-emerald-700 dark:text-emerald-400">
                  <span>Already Paid:</span>
                  <span>
                    - {formatCurrency(alreadyPaid, settings.currencySymbol, settings.currency)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between font-mono pt-1 border-t border-slate-200 dark:border-slate-700 font-bold">
                <span className="text-slate-700 dark:text-slate-300">Remaining Balance:</span>
                <span className="text-slate-900 dark:text-white">
                  {formatCurrency(balanceDue, settings.currencySymbol, settings.currency)}
                </span>
              </div>
            </div>
          )}

          {/* Payment Type Selection (Full vs Partial) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPaymentType('FULL');
                setAmountPaid(balanceDue > 0 ? balanceDue.toFixed(2) : '');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg border text-center transition-colors ${
                paymentType === 'FULL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold border-transparent'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Full Payment ({formatCurrency(balanceDue, settings.currencySymbol, settings.currency)})
            </button>
            <button
              type="button"
              onClick={() => setPaymentType('PARTIAL')}
              className={`flex-1 py-1.5 px-3 rounded-lg border text-center transition-colors ${
                paymentType === 'PARTIAL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold border-transparent'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Partial Payment
            </button>
          </div>

          {/* Amount Paid Field */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amount Paid ({settings.currencySymbol}) *
            </label>
            <input
              type="number"
              required
              min="1"
              step="any"
              placeholder="e.g. 5000"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-sm font-semibold"
            />
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="Auto Debit">Auto Debit (NACH / ECS)</option>
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="Bank Transfer">Bank Transfer (NEFT / IMPS)</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Transaction / Ref Number
              </label>
              <input
                type="text"
                placeholder="e.g. UTR-98213401"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Payment Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Debited from salary account #1092"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm"
            >
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

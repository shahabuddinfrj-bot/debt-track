import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  Calendar,
  CreditCard,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';
import {
  Deposit,
  DepositScheduleItem,
  DepositTransaction,
  DepositTransactionType,
} from '../../types/deposit';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface RecordDepositPaymentModalProps {
  depositId: string | null;
  targetInstallmentNumber?: number;
  settings: UserSettings;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordDepositPaymentModal: React.FC<RecordDepositPaymentModalProps> = ({
  depositId,
  targetInstallmentNumber,
  settings,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedDepositId, setSelectedDepositId] = useState<string>(depositId || '');
  const [transactionType, setTransactionType] = useState<DepositTransactionType>('CONTRIBUTION');
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(CURRENT_DATE_STR);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const deposits = storageService.getDeposits(false);

  useEffect(() => {
    if (depositId) {
      setSelectedDepositId(depositId);
    } else if (deposits.length > 0 && !selectedDepositId) {
      setSelectedDepositId(deposits[0].id);
    }
  }, [depositId, deposits]);

  const currentDeposit = selectedDepositId ? storageService.getDeposit(selectedDepositId) : null;
  const schedule = selectedDepositId ? storageService.getDepositSchedule(selectedDepositId) : [];

  // Find target or next pending installment for RD
  useEffect(() => {
    if (currentDeposit?.type === 'RD' && schedule.length > 0) {
      let targetItem: DepositScheduleItem | undefined;
      if (targetInstallmentNumber) {
        targetItem = schedule.find((s) => s.installmentNumber === targetInstallmentNumber);
      }
      if (!targetItem) {
        targetItem = schedule.find((s) => s.status === 'PENDING' || s.status === 'PARTIAL' || s.status === 'MISSED');
      }
      if (targetItem) {
        setSelectedInstallmentId(targetItem.id);
        const remainingForThis = Math.max(0, targetItem.expectedAmount - targetItem.paidAmount);
        setAmount(String(remainingForThis || targetItem.expectedAmount));
      } else {
        setSelectedInstallmentId('');
        if (currentDeposit.monthlyContribution) {
          setAmount(String(currentDeposit.monthlyContribution));
        }
      }
    } else if (currentDeposit?.monthlyContribution) {
      setAmount(String(currentDeposit.monthlyContribution));
    }
  }, [selectedDepositId, targetInstallmentNumber, isOpen]);

  if (!isOpen) return null;

  const handleInstallmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const instId = e.target.value;
    setSelectedInstallmentId(instId);
    const item = schedule.find((s) => s.id === instId);
    if (item) {
      const remainingForThis = Math.max(0, item.expectedAmount - item.paidAmount);
      setAmount(String(remainingForThis || item.expectedAmount));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedDepositId) {
      setErrorMsg('Please select a valid deposit account.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid contribution amount greater than 0.');
      return;
    }

    if (!transactionDate) {
      setErrorMsg('Please select a valid payment date.');
      return;
    }

    setIsSubmitting(true);

    try {
      const txId = 'dptx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const tx: DepositTransaction = {
        id: txId,
        depositId: selectedDepositId,
        scheduleItemId: transactionType === 'CONTRIBUTION' ? selectedInstallmentId || undefined : undefined,
        amount: Math.round(numAmount * 100) / 100,
        transactionDate,
        transactionType,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      storageService.saveDepositTransaction(tx);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record deposit transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/40">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Record Deposit Contribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Credit installment, interest, or manage balance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Deposit Account Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Deposit / Savings Account
            </label>
            <select
              value={selectedDepositId}
              onChange={(e) => setSelectedDepositId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            >
              {deposits.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type}) — Bal:{' '}
                  {formatCurrency(d.currentBalance || d.principalAmount, settings.currencySymbol, settings.currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'CONTRIBUTION', label: 'Contribution', icon: ArrowUpCircle, color: 'emerald' },
                { id: 'INTEREST', label: 'Interest Credit', icon: TrendingUp, color: 'blue' },
                { id: 'WITHDRAWAL', label: 'Withdrawal', icon: ArrowDownCircle, color: 'amber' },
                { id: 'ADJUSTMENT', label: 'Adjustment', icon: PiggyBank, color: 'slate' },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTransactionType(t.id as DepositTransactionType)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    transactionType === t.id
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs">{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* RD Installment Selector if RD & CONTRIBUTION */}
          {currentDeposit?.type === 'RD' && transactionType === 'CONTRIBUTION' && schedule.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Linked Installment / Due Date
              </label>
              <select
                value={selectedInstallmentId}
                onChange={handleInstallmentChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
              >
                <option value="">-- General / Extra Contribution (Not linked) --</option>
                {schedule.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.installmentNumber} — Due: {formatDate(item.dueDate, settings.dateFormat)} — Exp:{' '}
                    {formatCurrency(item.expectedAmount, settings.currencySymbol, settings.currency)} [
                    {item.status}]
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount ({settings.currencySymbol}) *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transaction Date *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reference / UTR / Transaction ID (Optional)
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. UPI/123456789 or NEFT-0987"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes / Remark (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. October monthly RD contribution"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Quick Pay Buttons if RD */}
          {currentDeposit?.monthlyContribution && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Quick Fill:</span>
              <button
                type="button"
                onClick={() => setAmount(String(currentDeposit.monthlyContribution))}
                className="px-2.5 py-1 text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
              >
                1 Installment (
                {formatCurrency(currentDeposit.monthlyContribution, settings.currencySymbol, settings.currency)})
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording...' : 'Record Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

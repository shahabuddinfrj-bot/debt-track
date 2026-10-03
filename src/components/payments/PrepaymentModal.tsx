import React, { useState } from 'react';
import { X, TrendingDown, ArrowDownCircle, CheckCircle2 } from 'lucide-react';
import { Loan, UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { recalculateScheduleWithPrepayment } from '../../utils/financialCalculations';

interface PrepaymentModalProps {
  loanId: string;
  settings: UserSettings;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PrepaymentModal: React.FC<PrepaymentModalProps> = ({
  loanId,
  settings,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const loan = storageService.getLoanById(loanId);
  const schedule = storageService.getSchedule(loanId);

  const [prepayType, setPrepayType] = useState<'PART_PAYMENT' | 'FORECLOSURE'>('PART_PAYMENT');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(CURRENT_DATE_STR);
  const [reductionOption, setReductionOption] = useState<'REDUCE_TENURE' | 'REDUCE_EMI'>('REDUCE_TENURE');
  const [notes, setNotes] = useState<string>('');

  if (!isOpen || !loan) return null;

  const currentOutstanding = loan.outstandingPrincipal;
  const numAmount = parseFloat(amount) || 0;

  // If Foreclosure is chosen, amount equals outstanding principal
  const effectiveAmount = prepayType === 'FORECLOSURE' ? currentOutstanding : numAmount;

  // Live recalculate schedule preview
  const newSchedule = recalculateScheduleWithPrepayment(
    schedule,
    date,
    effectiveAmount,
    reductionOption,
    loan.interestRate,
    loan.interestType,
    loan.emiFrequency
  );

  const remainingItems = newSchedule.filter((s) => s.status !== 'PAID');
  const newRemainingMonths = remainingItems.length;
  const newNextEmi = remainingItems[0]?.emiAmount || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (effectiveAmount <= 0) {
      alert('Please enter a prepayment amount greater than zero.');
      return;
    }
    if (effectiveAmount > currentOutstanding) {
      alert(`Prepayment cannot exceed the current outstanding principal of ${formatCurrency(currentOutstanding, settings.currencySymbol, settings.currency)}.`);
      return;
    }

    const result = storageService.recordPrepayment(loan.id, {
      amount: effectiveAmount,
      date,
      type: prepayType,
      reductionOption,
      notes: notes.trim() || undefined,
    });

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      alert(result.error || 'Failed to record prepayment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Prepayment & Foreclosure
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {loan.name} ({loan.lender})
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
          {/* Prepayment Type */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPrepayType('PART_PAYMENT');
                setAmount('');
              }}
              className={`flex-1 py-2 px-3 rounded-lg border text-center transition-colors ${
                prepayType === 'PART_PAYMENT'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold border-transparent'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Part-Prepayment
            </button>
            <button
              type="button"
              onClick={() => {
                setPrepayType('FORECLOSURE');
                setAmount(currentOutstanding.toString());
              }}
              className={`flex-1 py-2 px-3 rounded-lg border text-center transition-colors ${
                prepayType === 'FORECLOSURE'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold border-transparent'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Full Foreclosure (Pay Off)
            </button>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Prepayment Amount ({settings.currencySymbol}) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                max={currentOutstanding}
                placeholder="e.g. 50000"
                readOnly={prepayType === 'FORECLOSURE'}
                value={prepayType === 'FORECLOSURE' ? currentOutstanding : amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-semibold"
              />
              <span className="text-[10px] text-slate-600 dark:text-slate-300">
                Max: {formatCurrency(currentOutstanding, settings.currencySymbol, settings.currency)}
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Reduction Choice (Only for Part Payment) */}
          {prepayType === 'PART_PAYMENT' && (
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                How should this prepayment benefit your loan?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReductionOption('REDUCE_TENURE')}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    reductionOption === 'REDUCE_TENURE'
                      ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white">Reduce Tenure</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Keep EMI same, finish loan months earlier.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReductionOption('REDUCE_EMI')}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    reductionOption === 'REDUCE_EMI'
                      ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white">Reduce EMI</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Lower your monthly cash commitment.
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Impact Recalculation Preview */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <div className="font-semibold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
              Recalculation Impact Preview
            </div>

            {prepayType === 'FORECLOSURE' ? (
              <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                Loan will be marked as CLOSED and fully settled. 0 remaining EMIs!
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">
                  <div className="text-slate-600 dark:text-slate-300">Remaining Months:</div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {loan.emisRemaining} &rarr;{' '}
                    <span className="text-emerald-700 dark:text-emerald-400">{newRemainingMonths}</span>
                  </div>
                </div>

                <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">
                  <div className="text-slate-600 dark:text-slate-300">Monthly EMI:</div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(loan.emiAmount, settings.currencySymbol, settings.currency)} &rarr;{' '}
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(newNextEmi, settings.currencySymbol, settings.currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid out of annual bonus"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          {/* Actions */}
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
              Apply Prepayment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

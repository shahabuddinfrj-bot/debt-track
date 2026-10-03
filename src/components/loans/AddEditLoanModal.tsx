import React, { useState, useEffect } from 'react';
import {
  Calculator,
  HelpCircle,
  X,
  CheckCircle2,
  Calendar,
  Building,
  DollarSign,
  Percent,
} from 'lucide-react';
import {
  EMIFrequency,
  InterestType,
  Loan,
  LoanStatus,
  LoanType,
  UserSettings,
} from '../../types/loan';
import {
  calculateEMI,
  generateAmortizationSchedule,
} from '../../utils/financialCalculations';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface AddEditLoanModalProps {
  initialLoan?: Loan | null;
  settings: UserSettings;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (loanId: string) => void;
}

export const AddEditLoanModal: React.FC<AddEditLoanModalProps> = ({
  initialLoan,
  settings,
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Input calculation mode
  const [inputMode, setInputMode] = useState<'CALCULATE_EMI' | 'ENTER_EMI'>('CALCULATE_EMI');

  // Form State (Strings so typing never prefixes an accidental 0)
  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [loanType, setLoanType] = useState<LoanType>('Personal Loan');
  const [accountNumber, setAccountNumber] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [disbursedAmount, setDisbursedAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [interestType, setInterestType] = useState<InterestType>('REDUCING_BALANCE');
  const [tenureMonths, setTenureMonths] = useState('');
  const [startDate, setStartDate] = useState(CURRENT_DATE_STR);
  const [firstEmiDate, setFirstEmiDate] = useState('2026-11-05');
  const [emiAmount, setEmiAmount] = useState('');
  const [emiFrequency, setEmiFrequency] = useState<EMIFrequency>('MONTHLY');
  const [emiDueDay, setEmiDueDay] = useState('5');
  const [processingFee, setProcessingFee] = useState('');
  const [otherCharges, setOtherCharges] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<LoanStatus>('ACTIVE');

  // Populate if editing, or clear completely for new loan
  useEffect(() => {
    if (initialLoan) {
      setName(initialLoan.name);
      setLender(initialLoan.lender);
      setLoanType(initialLoan.loanType);
      setAccountNumber(initialLoan.accountNumber);
      setOriginalAmount(initialLoan.originalAmount ? initialLoan.originalAmount.toString() : '');
      setDisbursedAmount(initialLoan.disbursedAmount ? initialLoan.disbursedAmount.toString() : '');
      setInterestRate(initialLoan.interestRate !== undefined ? initialLoan.interestRate.toString() : '');
      setInterestType(initialLoan.interestType);
      setTenureMonths(initialLoan.tenureMonths ? initialLoan.tenureMonths.toString() : '');
      setStartDate(initialLoan.startDate);
      setFirstEmiDate(initialLoan.firstEmiDate);
      setEmiAmount(initialLoan.emiAmount ? initialLoan.emiAmount.toString() : '');
      setEmiFrequency(initialLoan.emiFrequency);
      setEmiDueDay(initialLoan.emiDueDay ? initialLoan.emiDueDay.toString() : '5');
      setProcessingFee(initialLoan.processingFee ? initialLoan.processingFee.toString() : '');
      setOtherCharges(initialLoan.otherCharges ? initialLoan.otherCharges.toString() : '');
      setNotes(initialLoan.notes || '');
      setStatus(initialLoan.status);
      setInputMode(initialLoan.calculationSource === 'USER_ENTERED' ? 'ENTER_EMI' : 'CALCULATE_EMI');
    } else {
      // Clean empty state for new loan
      setName('');
      setLender('');
      setLoanType('Personal Loan');
      setAccountNumber('');
      setOriginalAmount('');
      setDisbursedAmount('');
      setInterestRate('');
      setInterestType('REDUCING_BALANCE');
      setTenureMonths('');
      setStartDate(CURRENT_DATE_STR);
      setFirstEmiDate('2026-11-05');
      setEmiAmount('');
      setEmiFrequency('MONTHLY');
      setEmiDueDay('5');
      setProcessingFee('');
      setOtherCharges('');
      setNotes('');
      setStatus('ACTIVE');
      setInputMode('CALCULATE_EMI');
    }
  }, [initialLoan, isOpen]);

  // Numerical conversions
  const numOriginal = parseFloat(originalAmount) || 0;
  const numRate = parseFloat(interestRate) || 0;
  const numTenure = parseInt(tenureMonths, 10) || 0;
  const numDisbursed = parseFloat(disbursedAmount) || numOriginal;
  const numProcessing = parseFloat(processingFee) || 0;
  const numOther = parseFloat(otherCharges) || 0;
  const numDueDay = parseInt(emiDueDay, 10) || 1;

  // Recalculate preview
  const calcResult = calculateEMI(
    numOriginal,
    numRate,
    numTenure,
    interestType,
    emiFrequency
  );

  // Sync EMI if in CALCULATE_EMI mode
  useEffect(() => {
    if (inputMode === 'CALCULATE_EMI') {
      if (numOriginal > 0 && numTenure > 0) {
        setEmiAmount(calcResult.emi > 0 ? calcResult.emi.toString() : '');
      } else {
        setEmiAmount('');
      }
    }
  }, [numOriginal, numRate, numTenure, interestType, emiFrequency, inputMode, calcResult.emi]);

  if (!isOpen) return null;

  const numEmi = parseFloat(emiAmount) || 0;
  const finalEmi = inputMode === 'ENTER_EMI' ? numEmi : calcResult.emi;

  // Calculation preview items
  const previewSchedule = generateAmortizationSchedule(
    numOriginal,
    numRate,
    numTenure,
    startDate,
    firstEmiDate,
    interestType,
    emiFrequency,
    finalEmi
  );

  const previewTotalInterest = previewSchedule.reduce((sum, item) => sum + item.interestComponent, 0);
  const previewTotalPayable = numOriginal + previewTotalInterest;
  const previewClosureDate = previewSchedule.length > 0 ? previewSchedule[previewSchedule.length - 1].dueDate : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a loan title.');
      return;
    }
    if (!lender.trim()) {
      alert('Please enter lender / bank name.');
      return;
    }
    if (numOriginal <= 0) {
      alert('Please enter a valid loan amount.');
      return;
    }
    if (numTenure <= 0) {
      alert('Tenure must be at least 1 month.');
      return;
    }
    if (finalEmi <= 0) {
      alert('Please enter or calculate an EMI amount.');
      return;
    }

    const loanId = initialLoan ? initialLoan.id : 'loan_' + Date.now();
    const source = inputMode === 'ENTER_EMI' ? 'USER_ENTERED' : 'SYSTEM_CALCULATED';

    const fullSchedule = generateAmortizationSchedule(
      numOriginal,
      numRate,
      numTenure,
      startDate,
      firstEmiDate,
      interestType,
      emiFrequency,
      finalEmi
    );

    const calculatedTotalInterest = fullSchedule.reduce((sum, item) => sum + item.interestComponent, 0);

    const newLoan: Loan = {
      id: loanId,
      name: name.trim(),
      lender: lender.trim(),
      loanType,
      accountNumber: accountNumber.trim(),
      originalAmount: numOriginal,
      disbursedAmount: numDisbursed,
      outstandingPrincipal: initialLoan ? initialLoan.outstandingPrincipal : numOriginal,
      interestRate: numRate,
      interestType,
      tenureMonths: numTenure,
      startDate,
      firstEmiDate,
      emiAmount: finalEmi,
      emiFrequency,
      emiDueDay: numDueDay,
      totalEmis: fullSchedule.length,
      emisPaid: initialLoan ? initialLoan.emisPaid : 0,
      emisRemaining: initialLoan ? initialLoan.emisRemaining : fullSchedule.length,
      nextEmiDate: initialLoan ? initialLoan.nextEmiDate : (fullSchedule[0]?.dueDate || ''),
      nextEmiAmount: initialLoan ? initialLoan.nextEmiAmount : (fullSchedule[0]?.emiAmount || finalEmi),
      expectedClosureDate: fullSchedule[fullSchedule.length - 1]?.dueDate || '',
      processingFee: numProcessing,
      otherCharges: numOther,
      totalInterest: Number(calculatedTotalInterest.toFixed(2)),
      totalPayableAmount: Number((numOriginal + calculatedTotalInterest).toFixed(2)),
      totalPrincipalPaid: initialLoan ? initialLoan.totalPrincipalPaid : 0,
      totalInterestPaid: initialLoan ? initialLoan.totalInterestPaid : 0,
      status,
      notes: notes.trim(),
      calculationSource: source,
      createdAt: initialLoan ? initialLoan.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If editing existing, preserve past payments
    let mergedSchedule = fullSchedule;
    if (initialLoan) {
      const existingSchedule = storageService.getSchedule(initialLoan.id);
      mergedSchedule = fullSchedule.map((item, idx) => {
        const exist = existingSchedule[idx];
        if (exist && (exist.status === 'PAID' || exist.status === 'PARTIAL')) {
          return {
            ...item,
            status: exist.status,
            paidAmount: exist.paidAmount,
            actualPaymentDate: exist.actualPaymentDate,
            payments: exist.payments,
          };
        }
        return item;
      });
    }

    storageService.saveLoan(newLoan, mergedSchedule);
    onSuccess(loanId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {initialLoan ? 'Edit Loan Account' : 'Add New Loan'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Enter your loan details to generate accurate amortization and payment schedules.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Dual Input Mode Toggle */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">
                Calculation Mode
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Choose how you want DebtTrack to determine your EMI and schedule.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setInputMode('CALCULATE_EMI')}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                  inputMode === 'CALCULATE_EMI'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Auto-Calculate EMI
              </button>
              <button
                type="button"
                onClick={() => setInputMode('ENTER_EMI')}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                  inputMode === 'ENTER_EMI'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                I Know My EMI
              </button>
            </div>
          </div>

          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-slate-100 dark:border-slate-800 pb-1">
              1. Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Loan Name / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Home Loan, SUV Car Loan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lender / Bank *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, SBI, ICICI, Bajaj"
                  value={lender}
                  onChange={(e) => setLender(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Loan Type
                </label>
                <select
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="Personal Loan">Personal Loan</option>
                  <option value="Home Loan">Home Loan</option>
                  <option value="Vehicle Loan">Vehicle Loan</option>
                  <option value="Business Loan">Business Loan</option>
                  <option value="Gold Loan">Gold Loan</option>
                  <option value="Consumer Loan">Consumer Loan</option>
                  <option value="Credit Card EMI">Credit Card EMI</option>
                  <option value="Education Loan">Education Loan</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Account / Loan Ref Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. LN-984210"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Financial Terms */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-slate-100 dark:border-slate-800 pb-1">
              2. Financial Terms
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Original Loan Amount ({settings.currencySymbol}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="e.g. 500000"
                  value={originalAmount}
                  onChange={(e) => setOriginalAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Interest Rate (% per annum) <span className="text-[11px] font-normal text-slate-500">(Optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  placeholder="e.g. 10.5 (leave empty for 0%)"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Interest Calculation Type
                </label>
                <select
                  value={interestType}
                  onChange={(e) => setInterestType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="REDUCING_BALANCE">Reducing Balance (Standard)</option>
                  <option value="FLAT_RATE">Flat Rate</option>
                  <option value="INTEREST_ONLY">Interest Only (Bullet Principal)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Disbursed Amount ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 495000"
                  value={disbursedAmount}
                  onChange={(e) => setDisbursedAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Processing Fee ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0 (optional)"
                  value={processingFee}
                  onChange={(e) => setProcessingFee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Other / Insurance Charges
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0 (optional)"
                  value={otherCharges}
                  onChange={(e) => setOtherCharges(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Repayment Schedule Parameters */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] border-b border-slate-100 dark:border-slate-800 pb-1">
              3. Repayment Schedule
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tenure (Months) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="480"
                  placeholder="e.g. 36"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  EMI Amount ({settings.currencySymbol}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="e.g. 15000"
                  readOnly={inputMode === 'CALCULATE_EMI'}
                  value={inputMode === 'ENTER_EMI' ? emiAmount : (calcResult.emi > 0 ? calcResult.emi.toString() : '')}
                  onChange={(e) => setEmiAmount(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-slate-900 dark:text-white font-mono ${
                    inputMode === 'CALCULATE_EMI'
                      ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                  }`}
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  EMI Frequency
                </label>
                <select
                  value={emiFrequency}
                  onChange={(e) => setEmiFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Loan Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  First EMI Date *
                </label>
                <input
                  type="date"
                  required
                  value={firstEmiDate}
                  onChange={(e) => {
                    setFirstEmiDate(e.target.value);
                    const parts = e.target.value.split('-');
                    if (parts[2]) setEmiDueDay(parseInt(parts[2], 10).toString());
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Due Day (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="5"
                  value={emiDueDay}
                  onChange={(e) => setEmiDueDay(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks / Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Fixed rate for 2 years then floating, collateral documents deposited with bank..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          {/* LIVE CALCULATION PREVIEW CARD */}
          {numOriginal > 0 && numTenure > 0 && finalEmi > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                  Calculation Preview
                </span>
                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  Source: {inputMode === 'ENTER_EMI' ? 'User-Entered EMI' : 'System Calculated'}
                  {numRate === 0 && ' · 0% Interest (Principal Only)'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-600 dark:text-slate-300">Monthly EMI</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm tabular-nums mt-0.5">
                    {formatCurrency(finalEmi, settings.currencySymbol, settings.currency)}
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-600 dark:text-slate-300">Total Interest</div>
                  <div className="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm tabular-nums mt-0.5">
                    {formatCurrency(previewTotalInterest, settings.currencySymbol, settings.currency)}
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-600 dark:text-slate-300">Total Payable</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm tabular-nums mt-0.5">
                    {formatCurrency(previewTotalPayable, settings.currencySymbol, settings.currency)}
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] text-slate-600 dark:text-slate-300">Estimated Closure</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm tabular-nums mt-0.5">
                    {previewClosureDate ? formatDate(previewClosureDate, settings.dateFormat) : '—'}
                  </div>
                </div>
              </div>

              {/* First 3 EMIs sample */}
              {previewSchedule.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mb-1 font-medium">
                    First 3 Installments Breakdown:
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] font-mono text-left">
                      <thead className="text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="py-1">EMI #</th>
                          <th className="py-1">Due Date</th>
                          <th className="py-1 text-right">Principal Part</th>
                          <th className="py-1 text-right">Interest Part</th>
                          <th className="py-1 text-right">Balance After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {previewSchedule.slice(0, 3).map((item) => (
                          <tr key={item.paymentNo}>
                            <td className="py-1">#{item.paymentNo}</td>
                            <td className="py-1">{formatDate(item.dueDate, settings.dateFormat)}</td>
                            <td className="py-1 text-right text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(item.principalComponent, settings.currencySymbol, settings.currency)}
                            </td>
                            <td className="py-1 text-right text-amber-700 dark:text-amber-400">
                              {formatCurrency(item.interestComponent, settings.currencySymbol, settings.currency)}
                            </td>
                            <td className="py-1 text-right">
                              {formatCurrency(item.closingPrincipal, settings.currencySymbol, settings.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm"
            >
              {initialLoan ? 'Save Changes' : 'Save Loan & Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  PiggyBank,
  Building,
  Calendar,
  DollarSign,
  Percent,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import {
  Deposit,
  DepositFrequency,
  DepositInterestType,
  DepositType,
} from '../../types/deposit';
import { UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import {
  calculateFDMaturity,
  calculateRDMaturity,
  generateDepositSchedule,
  addMonthsToDate,
  roundCurrency,
} from '../../utils/depositCalculations';
import { formatCurrency } from '../../utils/formatters';

interface AddEditDepositModalProps {
  initialDeposit?: Deposit | null;
  settings: UserSettings;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (depositId: string) => void;
}

export const AddEditDepositModal: React.FC<AddEditDepositModalProps> = ({
  initialDeposit,
  settings,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(initialDeposit);

  // Form Fields
  const [name, setName] = useState('');
  const [type, setType] = useState<DepositType>('RD');
  const [institutionName, setInstitutionName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [contributionFrequency, setContributionFrequency] = useState<DepositFrequency>('MONTHLY');
  const [depositDueDay, setDepositDueDay] = useState('5');
  const [tenureMonths, setTenureMonths] = useState('12');
  const [startDate, setStartDate] = useState(CURRENT_DATE_STR);
  const [maturityDate, setMaturityDate] = useState('');
  const [interestRate, setInterestRate] = useState('7.0');
  const [interestType, setInterestType] = useState<DepositInterestType>('COMPOUND_QUARTERLY');
  const [targetAmount, setTargetAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Validation state
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-fill when editing or reset when adding
  useEffect(() => {
    if (initialDeposit) {
      setName(initialDeposit.name || '');
      setType(initialDeposit.type || 'RD');
      setInstitutionName(initialDeposit.institutionName || '');
      setAccountNumber(initialDeposit.accountNumber || '');
      setPrincipalAmount(initialDeposit.principalAmount ? String(initialDeposit.principalAmount) : '');
      setMonthlyContribution(initialDeposit.monthlyContribution ? String(initialDeposit.monthlyContribution) : '');
      setContributionFrequency(initialDeposit.contributionFrequency || 'MONTHLY');
      setDepositDueDay(initialDeposit.depositDueDay ? String(initialDeposit.depositDueDay) : '5');
      setTenureMonths(initialDeposit.tenureMonths ? String(initialDeposit.tenureMonths) : '12');
      setStartDate(initialDeposit.startDate || CURRENT_DATE_STR);
      setMaturityDate(initialDeposit.maturityDate || '');
      setInterestRate(initialDeposit.interestRate !== undefined ? String(initialDeposit.interestRate) : '7.0');
      setInterestType(initialDeposit.interestType || 'COMPOUND_QUARTERLY');
      setTargetAmount(initialDeposit.targetAmount ? String(initialDeposit.targetAmount) : '');
      setNotes(initialDeposit.notes || '');
    } else {
      setName('');
      setType('RD');
      setInstitutionName('');
      setAccountNumber('');
      setPrincipalAmount('');
      setMonthlyContribution('5000');
      setContributionFrequency('MONTHLY');
      setDepositDueDay('5');
      setTenureMonths('12');
      setStartDate(CURRENT_DATE_STR);
      setMaturityDate(addMonthsToDate(CURRENT_DATE_STR, 12, 5));
      setInterestRate('7.0');
      setInterestType('COMPOUND_QUARTERLY');
      setTargetAmount('');
      setNotes('');
    }
    setErrorMsg('');
  }, [initialDeposit, isOpen]);

  // Auto-calculate maturity date when tenure or startDate changes (if not manually altered)
  useEffect(() => {
    const tenureNum = parseInt(tenureMonths, 10);
    const dueDayNum = parseInt(depositDueDay, 10) || 5;
    if (startDate && tenureNum > 0) {
      setMaturityDate(addMonthsToDate(startDate, tenureNum, dueDayNum));
    }
  }, [startDate, tenureMonths, depositDueDay]);

  if (!isOpen) return null;

  // Live calculation preview
  const numContribution = parseFloat(monthlyContribution) || 0;
  const numPrincipal = parseFloat(principalAmount) || 0;
  const numRate = parseFloat(interestRate) || 0;
  const numTenure = parseInt(tenureMonths, 10) || 0;

  let livePreview: {
    totalInvested: number;
    interestEarned: number;
    maturityAmount: number;
    installmentsCount?: number;
  } | null = null;

  if (type === 'RD' && numContribution > 0 && numTenure > 0) {
    const rdResult = calculateRDMaturity(
      numContribution,
      numRate,
      numTenure,
      contributionFrequency,
      interestType
    );
    livePreview = {
      totalInvested: rdResult.totalPrincipal,
      interestEarned: rdResult.totalInterest,
      maturityAmount: rdResult.maturityAmount,
      installmentsCount: rdResult.totalInstallments,
    };
  } else if (type === 'FD' && numPrincipal > 0 && numTenure > 0) {
    const fdResult = calculateFDMaturity(numPrincipal, numRate, numTenure, interestType);
    livePreview = {
      totalInvested: fdResult.totalPrincipal,
      interestEarned: fdResult.totalInterest,
      maturityAmount: fdResult.maturityAmount,
    };
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validations
    if (!name.trim()) {
      setErrorMsg('Please enter a deposit/account name.');
      return;
    }
    if (!startDate) {
      setErrorMsg('Please select a valid start date.');
      return;
    }

    if (type === 'RD') {
      if (numContribution <= 0) {
        setErrorMsg('Please enter a valid recurring contribution amount (> 0).');
        return;
      }
      if (numTenure <= 0) {
        setErrorMsg('Please enter a valid tenure in months (> 0).');
        return;
      }
      if (numRate < 0) {
        setErrorMsg('Interest rate cannot be negative.');
        return;
      }
    } else if (type === 'FD') {
      if (numPrincipal <= 0) {
        setErrorMsg('Please enter a valid principal deposit amount (> 0).');
        return;
      }
      if (numTenure <= 0) {
        setErrorMsg('Please enter a valid tenure in months (> 0).');
        return;
      }
      if (numRate < 0) {
        setErrorMsg('Interest rate cannot be negative.');
        return;
      }
    } else if (type === 'SAVINGS_GOAL') {
      const numTarget = parseFloat(targetAmount) || 0;
      if (numTarget <= 0) {
        setErrorMsg('Please enter a target goal amount (> 0).');
        return;
      }
    } else if (type === 'SAVINGS') {
      if (numPrincipal < 0) {
        setErrorMsg('Initial balance cannot be negative.');
        return;
      }
    }

    const depositId = initialDeposit ? initialDeposit.id : 'dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    let calculatedMaturityAmount = 0;
    let totalExpectedContrib = 0;
    let expectedInterest = 0;

    if (type === 'RD' && livePreview) {
      calculatedMaturityAmount = livePreview.maturityAmount;
      totalExpectedContrib = livePreview.totalInvested;
      expectedInterest = livePreview.interestEarned;
    } else if (type === 'FD' && livePreview) {
      calculatedMaturityAmount = livePreview.maturityAmount;
      totalExpectedContrib = livePreview.totalInvested;
      expectedInterest = livePreview.interestEarned;
    } else if (type === 'SAVINGS_GOAL') {
      calculatedMaturityAmount = parseFloat(targetAmount) || 0;
      totalExpectedContrib = parseFloat(targetAmount) || 0;
    } else {
      calculatedMaturityAmount = numPrincipal;
      totalExpectedContrib = numPrincipal;
    }

    const dueDayNum = parseInt(depositDueDay, 10) || 5;

    const depositData: Deposit = {
      id: depositId,
      name: name.trim(),
      type,
      institutionName: institutionName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      principalAmount: type === 'RD' ? 0 : roundCurrency(numPrincipal),
      monthlyContribution: type === 'RD' || type === 'SAVINGS_GOAL' ? roundCurrency(numContribution) : undefined,
      contributionFrequency: type === 'RD' ? contributionFrequency : undefined,
      depositDueDay: type === 'RD' ? dueDayNum : undefined,
      tenureMonths: numTenure > 0 ? numTenure : undefined,
      totalInstallments: livePreview?.installmentsCount || (type === 'RD' ? numTenure : undefined),
      startDate,
      maturityDate: maturityDate || undefined,
      interestRate: numRate >= 0 ? numRate : undefined,
      interestType: interestType,
      targetAmount: type === 'SAVINGS_GOAL' ? roundCurrency(parseFloat(targetAmount) || 0) : undefined,
      currentBalance: initialDeposit
        ? initialDeposit.currentBalance
        : type === 'SAVINGS' || type === 'FD' || type === 'OTHER'
        ? roundCurrency(numPrincipal)
        : 0,
      totalExpectedContribution: roundCurrency(totalExpectedContrib),
      totalContributionsPaid: initialDeposit ? initialDeposit.totalContributionsPaid : 0,
      totalInterestEarned: initialDeposit ? initialDeposit.totalInterestEarned : roundCurrency(expectedInterest),
      expectedMaturityAmount: roundCurrency(calculatedMaturityAmount),
      status: initialDeposit ? initialDeposit.status : 'ACTIVE',
      notes: notes.trim() || undefined,
      createdAt: initialDeposit ? initialDeposit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If RD, generate initial schedule (preserve existing paid status if editing)
    let scheduleToSave = undefined;
    if (type === 'RD') {
      const existingSchedule = isEditing ? storageService.getDepositSchedule(depositId) : [];
      if (existingSchedule.length === 0 || !isEditing) {
        scheduleToSave = generateDepositSchedule(
          depositId,
          numContribution,
          numTenure,
          startDate,
          contributionFrequency,
          dueDayNum
        );
      }
    }

    storageService.saveDeposit(depositData, scheduleToSave);
    onSuccess(depositId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800/40">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Edit Deposit / Savings' : 'Add New Deposit or Savings Account'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track Recurring Deposits (RD), Fixed Deposits (FD), or Savings Goals
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Account Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Deposit / Asset Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'RD', label: 'Recurring Deposit (RD)', desc: 'Monthly savings' },
                { id: 'FD', label: 'Fixed Deposit (FD)', desc: 'Lump-sum term' },
                { id: 'SAVINGS', label: 'Savings Account', desc: 'Liquid balance' },
                { id: 'SAVINGS_GOAL', label: 'Savings Goal', desc: 'Target fund' },
                { id: 'OTHER', label: 'Other Asset', desc: 'Custom investment' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setType(opt.id as DepositType)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    type === opt.id
                      ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500/20 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.id}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* General Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Account / Deposit Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'RD' ? 'e.g. HDFC 1-Year Recurring Deposit' : type === 'FD' ? 'e.g. SBI 3-Year Fixed Deposit' : 'e.g. Emergency Savings Fund'}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bank / Post Office / Institution
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. HDFC Bank, SBI, India Post"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Account / Certificate / Folio Number
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. RD-9874561230"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start / Deposit Date *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Conditional Fields based on Deposit Type */}
          {type === 'RD' && (
            <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                <Clock className="w-4 h-4" />
                <span>Recurring Deposit Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Contribution ({settings.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={monthlyContribution}
                    onChange={(e) => setMonthlyContribution(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tenure (Months) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    required
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Day of Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={depositDueDay}
                    onChange={(e) => setDepositDueDay(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Annual Interest Rate (%)
                  </label>
                  <div className="relative">
                    <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      placeholder="e.g. 7.1"
                      className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Compounding Method
                  </label>
                  <select
                    value={interestType}
                    onChange={(e) => setInterestType(e.target.value as DepositInterestType)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    <option value="COMPOUND_QUARTERLY">Quarterly (Bank Standard)</option>
                    <option value="COMPOUND_MONTHLY">Monthly</option>
                    <option value="COMPOUND_ANNUALLY">Annually</option>
                    <option value="SIMPLE">Simple Interest</option>
                    <option value="NONE">No Interest</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Projected Maturity Date
                  </label>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'FD' && (
            <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                <DollarSign className="w-4 h-4" />
                <span>Fixed Deposit (Lump Sum) Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lump Sum Principal ({settings.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    placeholder="e.g. 100000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tenure (Months) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    required
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Annual Interest Rate (%)
                  </label>
                  <div className="relative">
                    <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      placeholder="e.g. 7.5"
                      className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Compounding Method
                  </label>
                  <select
                    value={interestType}
                    onChange={(e) => setInterestType(e.target.value as DepositInterestType)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    <option value="COMPOUND_QUARTERLY">Quarterly (Bank Standard)</option>
                    <option value="COMPOUND_MONTHLY">Monthly</option>
                    <option value="COMPOUND_ANNUALLY">Annually</option>
                    <option value="SIMPLE">Simple Interest</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Maturity Date
                  </label>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'SAVINGS' && (
            <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Balance ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Annual Interest Rate (%) (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="e.g. 3.5"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'SAVINGS_GOAL' && (
            <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Goal Amount ({settings.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Amount Saved ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Planned Contribution ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={monthlyContribution}
                    onChange={(e) => setMonthlyContribution(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'OTHER' && (
            <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Principal / Investment Amount ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Annual Return / Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="e.g. 8.0"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Live Financial Projection Box for RD and FD */}
          {livePreview && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Maturity & Returns Projection</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Invested</span>
                  <span className="text-xs font-mono font-bold">
                    {formatCurrency(livePreview.totalInvested, settings.currencySymbol, settings.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Projected Interest</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    +{formatCurrency(livePreview.interestEarned, settings.currencySymbol, settings.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Maturity Value</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {formatCurrency(livePreview.maturityAmount, settings.currencySymbol, settings.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes / Financial Goal Purpose (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Child education fund, tax saving 80C, planned vacation in 2028..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Actions */}
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
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'Update Deposit' : 'Save Deposit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

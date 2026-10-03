/**
 * Deposit & Recurring Deposit (RD) Financial Calculation Engine
 * 
 * DESIGN RULE: Completely independent of Loan EMI / amortization calculations.
 * Pure TypeScript functions with strict typing and defensive edge-case handling.
 */

import {
  Deposit,
  DepositCalculationResult,
  DepositFrequency,
  DepositInterestType,
  DepositProgressMetrics,
  DepositScheduleItem,
  DepositTransaction,
} from '../types/deposit';

/**
 * Rounds monetary amounts to 2 decimal places safely.
 */
export function roundCurrency(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Normalizes tenure in months to period counts based on frequency.
 */
export function getPeriodsPerYear(frequency: DepositFrequency = 'MONTHLY'): number {
  switch (frequency) {
    case 'QUARTERLY':
      return 4;
    case 'HALF_YEARLY':
      return 2;
    case 'ANNUAL':
      return 1;
    case 'ONE_TIME':
      return 1;
    case 'MONTHLY':
    default:
      return 12;
  }
}

/**
 * Returns number of months per installment period.
 */
export function getMonthsPerPeriod(frequency: DepositFrequency = 'MONTHLY'): number {
  switch (frequency) {
    case 'QUARTERLY':
      return 3;
    case 'HALF_YEARLY':
      return 6;
    case 'ANNUAL':
      return 12;
    case 'ONE_TIME':
      return 0;
    case 'MONTHLY':
    default:
      return 1;
  }
}

/**
 * Standard Compound Interest for a single lump-sum deposit (e.g. Fixed Deposit).
 * Formula: A = P * (1 + r / (100 * n))^(n * t)
 */
export function calculateCompoundDepositInterest(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
  compoundingType: DepositInterestType = 'COMPOUND_QUARTERLY'
): { maturityAmount: number; totalInterest: number } {
  const safePrincipal = Math.max(0, principal || 0);
  const safeRate = Math.max(0, annualRatePct || 0);
  const safeTenure = Math.max(0, tenureMonths || 0);

  if (safePrincipal === 0 || safeTenure === 0) {
    return { maturityAmount: safePrincipal, totalInterest: 0 };
  }

  if (safeRate === 0 || compoundingType === 'NONE') {
    return { maturityAmount: roundCurrency(safePrincipal), totalInterest: 0 };
  }

  const years = safeTenure / 12;

  if (compoundingType === 'SIMPLE') {
    const interest = safePrincipal * (safeRate / 100) * years;
    const maturity = safePrincipal + interest;
    return {
      maturityAmount: roundCurrency(maturity),
      totalInterest: roundCurrency(interest),
    };
  }

  let compoundsPerYear = 4; // Default standard banking quarterly compounding
  if (compoundingType === 'COMPOUND_MONTHLY') compoundsPerYear = 12;
  if (compoundingType === 'COMPOUND_ANNUALLY') compoundsPerYear = 1;

  const ratePerCompound = safeRate / (100 * compoundsPerYear);
  const totalCompounds = compoundsPerYear * years;
  const maturityAmount = safePrincipal * Math.pow(1 + ratePerCompound, totalCompounds);
  const totalInterest = maturityAmount - safePrincipal;

  return {
    maturityAmount: roundCurrency(maturityAmount),
    totalInterest: roundCurrency(totalInterest),
  };
}

/**
 * Standard Simple Interest calculation for deposits.
 * Formula: I = P * R * T / 100
 */
export function calculateSimpleDepositInterest(
  principal: number,
  annualRatePct: number,
  tenureMonths: number
): { maturityAmount: number; totalInterest: number } {
  return calculateCompoundDepositInterest(principal, annualRatePct, tenureMonths, 'SIMPLE');
}

/**
 * Calculates Recurring Deposit (RD) Maturity and Accrued Interest.
 * Uses the Indian Banking / RBI standard formula where each periodic installment
 * compounds quarterly (or monthly/annually as specified) for the duration it remains invested.
 */
export function calculateRDMaturity(
  monthlyContribution: number,
  annualRatePct: number,
  tenureMonths: number,
  frequency: DepositFrequency = 'MONTHLY',
  compoundingType: DepositInterestType = 'COMPOUND_QUARTERLY'
): {
  maturityAmount: number;
  totalPrincipal: number;
  totalInterest: number;
  totalInstallments: number;
} {
  const safeContribution = Math.max(0, monthlyContribution || 0);
  const safeRate = Math.max(0, annualRatePct || 0);
  const safeTenure = Math.max(0, tenureMonths || 0);

  const monthsPerPeriod = Math.max(1, getMonthsPerPeriod(frequency));
  const totalInstallments = Math.max(1, Math.round(safeTenure / monthsPerPeriod));
  const totalPrincipal = roundCurrency(safeContribution * totalInstallments);

  if (safeContribution === 0 || safeTenure === 0) {
    return {
      maturityAmount: 0,
      totalPrincipal: 0,
      totalInterest: 0,
      totalInstallments: 0,
    };
  }

  if (safeRate === 0 || compoundingType === 'NONE') {
    return {
      maturityAmount: totalPrincipal,
      totalPrincipal,
      totalInterest: 0,
      totalInstallments,
    };
  }

  let totalMaturity = 0;

  if (compoundingType === 'SIMPLE') {
    // Simple interest on each installment
    for (let i = 1; i <= totalInstallments; i++) {
      const monthsInvested = (totalInstallments - i + 1) * monthsPerPeriod;
      const years = monthsInvested / 12;
      const interest = safeContribution * (safeRate / 100) * years;
      totalMaturity += safeContribution + interest;
    }
  } else {
    // Compound interest: standard quarterly or monthly
    let compoundsPerYear = 4; // Quarterly standard
    if (compoundingType === 'COMPOUND_MONTHLY') compoundsPerYear = 12;
    if (compoundingType === 'COMPOUND_ANNUALLY') compoundsPerYear = 1;

    for (let i = 1; i <= totalInstallments; i++) {
      const monthsInvested = (totalInstallments - i + 1) * monthsPerPeriod;
      const years = monthsInvested / 12;
      const ratePerCompound = safeRate / (100 * compoundsPerYear);
      const compounds = compoundsPerYear * years;
      const futureValue = safeContribution * Math.pow(1 + ratePerCompound, compounds);
      totalMaturity += futureValue;
    }
  }

  const roundedMaturity = roundCurrency(totalMaturity);
  const roundedInterest = roundCurrency(Math.max(0, roundedMaturity - totalPrincipal));

  return {
    maturityAmount: roundedMaturity,
    totalPrincipal,
    totalInterest: roundedInterest,
    totalInstallments,
  };
}

/**
 * Calculates Fixed Deposit (FD) Maturity and Total Interest.
 */
export function calculateFDMaturity(
  principalAmount: number,
  annualRatePct: number,
  tenureMonths: number,
  compoundingType: DepositInterestType = 'COMPOUND_QUARTERLY'
): {
  maturityAmount: number;
  totalPrincipal: number;
  totalInterest: number;
} {
  const result = calculateCompoundDepositInterest(
    principalAmount,
    annualRatePct,
    tenureMonths,
    compoundingType
  );
  return {
    maturityAmount: result.maturityAmount,
    totalPrincipal: roundCurrency(principalAmount),
    totalInterest: result.totalInterest,
  };
}

/**
 * Helper to advance date by months preserving target day.
 */
export function addMonthsToDate(dateStr: string, monthsToAdd: number, targetDueDay?: number): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return dateStr;
  }

  const currentDay = targetDueDay || date.getDate();
  const targetMonth = date.getMonth() + monthsToAdd;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  // Find max days in the target month
  const maxDays = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const finalDay = Math.min(currentDay, maxDays);

  const newDate = new Date(targetYear, normalizedMonth, finalDay);
  return newDate.toISOString().split('T')[0];
}

/**
 * Generates the periodic contribution schedule for a Recurring Deposit.
 */
export function generateDepositSchedule(
  depositId: string,
  contributionAmount: number,
  tenureMonths: number,
  startDate: string,
  frequency: DepositFrequency = 'MONTHLY',
  dueDay?: number
): DepositScheduleItem[] {
  const safeAmount = Math.max(0, contributionAmount || 0);
  const safeTenure = Math.max(0, tenureMonths || 0);
  const monthsPerPeriod = Math.max(1, getMonthsPerPeriod(frequency));
  const totalInstallments = Math.max(1, Math.round(safeTenure / monthsPerPeriod));

  if (safeAmount === 0 || safeTenure === 0 || !startDate) {
    return [];
  }

  const schedule: DepositScheduleItem[] = [];

  for (let i = 1; i <= totalInstallments; i++) {
    const monthsOffset = (i - 1) * monthsPerPeriod;
    const dueDate = addMonthsToDate(startDate, monthsOffset, dueDay);

    schedule.push({
      id: `${depositId}_inst_${i}`,
      depositId,
      installmentNumber: i,
      dueDate,
      expectedAmount: roundCurrency(safeAmount),
      paidAmount: 0,
      status: 'PENDING',
    });
  }

  return schedule;
}

/**
 * Calculates current progress, completed installments, and next upcoming contribution.
 */
export function calculateDepositProgress(
  deposit: Deposit,
  schedule: DepositScheduleItem[] = [],
  transactions: DepositTransaction[] = [],
  referenceDateStr: string = new Date().toISOString().split('T')[0]
): DepositProgressMetrics {
  // Compute accumulated balance from transactions if available
  let calculatedBalance = 0;
  if (transactions && transactions.length > 0) {
    calculatedBalance = transactions.reduce((acc, tx) => {
      if (tx.transactionType === 'WITHDRAWAL') {
        return acc - (tx.amount || 0);
      }
      return acc + (tx.amount || 0);
    }, 0);
  } else if (schedule && schedule.length > 0) {
    calculatedBalance = schedule.reduce((acc, item) => acc + (item.paidAmount || 0), 0);
  } else {
    calculatedBalance = deposit.currentBalance || deposit.principalAmount || 0;
  }

  const targetOrMaturity =
    deposit.expectedMaturityAmount ||
    deposit.targetAmount ||
    deposit.totalExpectedContribution ||
    deposit.principalAmount ||
    1;

  const progressPercentage = Math.min(
    100,
    Math.max(0, roundCurrency((calculatedBalance / targetOrMaturity) * 100))
  );

  const completed = schedule.filter((s) => s.status === 'PAID').length;
  const remaining = schedule.filter((s) => s.status !== 'PAID').length;

  // Find next pending or missed installment
  const nextPendingItem = schedule
    .filter((s) => s.status === 'PENDING' || s.status === 'PARTIAL' || s.status === 'MISSED')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  const isMatured =
    deposit.status === 'MATURED' ||
    (Boolean(deposit.maturityDate) && referenceDateStr >= (deposit.maturityDate as string));

  return {
    currentBalance: roundCurrency(calculatedBalance),
    targetOrMaturityAmount: roundCurrency(targetOrMaturity),
    progressPercentage,
    installmentsCompleted: completed,
    installmentsRemaining: remaining,
    nextDueDate: nextPendingItem?.dueDate,
    nextDueAmount: nextPendingItem ? roundCurrency(nextPendingItem.expectedAmount - nextPendingItem.paidAmount) : undefined,
    isMatured,
  };
}

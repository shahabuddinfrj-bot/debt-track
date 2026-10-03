/**
 * Deposit & Recurring Deposit (RD) Types
 * 
 * DESIGN RULE: A Deposit Contribution is strictly distinct from a Loan EMI.
 * Loan / EMI terminology and calculations are strictly isolated.
 */

export type DepositType = 'RD' | 'FD' | 'SAVINGS' | 'SAVINGS_GOAL' | 'OTHER';

export type DepositStatus = 'ACTIVE' | 'MATURED' | 'CLOSED';

export type DepositInterestType =
  | 'COMPOUND_QUARTERLY'
  | 'COMPOUND_MONTHLY'
  | 'COMPOUND_ANNUALLY'
  | 'SIMPLE'
  | 'NONE';

export type DepositFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUAL' | 'ONE_TIME';

export type DepositScheduleStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'MISSED';

export type DepositTransactionType = 'CONTRIBUTION' | 'INTEREST' | 'ADJUSTMENT' | 'WITHDRAWAL';

export interface Deposit {
  id: string;
  userId?: string;
  name: string;
  type: DepositType;
  institutionName?: string;
  accountNumber?: string;
  principalAmount: number; // Initial lump sum (for FD/Savings) or starting principal
  monthlyContribution?: number; // Recurring contribution amount (for RD / Savings Goal)
  contributionFrequency?: DepositFrequency; // Frequency of contributions (default 'MONTHLY')
  depositDueDay?: number; // Due day of month (1-31) for recurring contribution
  tenureMonths?: number; // Total tenure in months
  totalInstallments?: number; // Total number of scheduled contributions
  startDate: string; // ISO date string (YYYY-MM-DD)
  maturityDate?: string; // Projected/target maturity date (YYYY-MM-DD)
  interestRate?: number; // Annual interest percentage (e.g. 7.1 for 7.1%)
  interestType?: DepositInterestType; // Compounding frequency or simple interest
  targetAmount?: number; // Target goal amount (for SAVINGS_GOAL)
  currentBalance?: number; // Current accrued balance including contributions & interest
  totalExpectedContribution?: number; // Sum of all expected installments + initial principal
  totalContributionsPaid?: number; // Total principal contributed so far
  totalInterestEarned?: number; // Total accrued or projected interest
  expectedMaturityAmount?: number; // Projected payout at maturity
  status: DepositStatus;
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DepositScheduleItem {
  id: string;
  depositId: string;
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  expectedAmount: number;
  paidAmount: number;
  status: DepositScheduleStatus;
  paidDate?: string; // YYYY-MM-DD
  transactionId?: string;
  notes?: string;
}

export interface DepositTransaction {
  id: string;
  depositId: string;
  scheduleItemId?: string;
  amount: number;
  transactionDate: string; // YYYY-MM-DD
  transactionType: DepositTransactionType;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface DepositCalculationResult {
  maturityAmount: number;
  totalPrincipal: number;
  totalInterest: number;
  effectiveRate: number;
  schedule: DepositScheduleItem[];
}

export interface DepositProgressMetrics {
  currentBalance: number;
  targetOrMaturityAmount: number;
  progressPercentage: number;
  installmentsCompleted: number;
  installmentsRemaining: number;
  nextDueDate?: string;
  nextDueAmount?: number;
  isMatured: boolean;
}

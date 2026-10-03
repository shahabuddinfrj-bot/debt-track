export type LoanStatus =
  | 'ACTIVE'
  | 'OVERDUE'
  | 'CLOSED'
  | 'FORECLOSED'
  | 'RESTRUCTURED'
  | 'ON_HOLD';

export type LoanType =
  | 'Personal Loan'
  | 'Home Loan'
  | 'Vehicle Loan'
  | 'Business Loan'
  | 'Gold Loan'
  | 'Consumer Loan'
  | 'Credit Card EMI'
  | 'Education Loan'
  | 'Other';

export type InterestType = 'REDUCING_BALANCE' | 'FLAT_RATE' | 'INTEREST_ONLY';

export type EMIFrequency = 'MONTHLY' | 'QUARTERLY';

export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE';

export type PaymentMethod =
  | 'Cash'
  | 'Bank Transfer'
  | 'UPI'
  | 'Auto Debit'
  | 'Cheque'
  | 'Other';

export interface PaymentTransaction {
  id: string;
  emiPaymentNo: number;
  loanId: string;
  paymentDate: string; // YYYY-MM-DD
  amountPaid: number;
  principalComponent: number;
  interestComponent: number;
  paymentMethod: PaymentMethod;
  transactionRef: string;
  notes?: string;
  createdAt: string;
}

export interface EMIScheduleItem {
  paymentNo: number;
  dueDate: string; // YYYY-MM-DD
  openingPrincipal: number;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  closingPrincipal: number;
  status: PaymentStatus;
  paidAmount: number;
  actualPaymentDate?: string;
  notes?: string;
  payments: PaymentTransaction[];
}

export interface Prepayment {
  id: string;
  loanId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  type: 'PART_PAYMENT' | 'FORECLOSURE';
  reductionOption: 'REDUCE_EMI' | 'REDUCE_TENURE';
  notes?: string;
  createdAt: string;
}

export interface LoanDocument {
  id: string;
  loanId: string;
  name: string;
  type:
    | 'Loan Agreement'
    | 'Sanction Letter'
    | 'Statement'
    | 'Repayment Schedule'
    | 'Insurance'
    | 'NOC'
    | 'Closure Letter'
    | 'Other';
  uploadDate: string;
  fileSize?: string;
  fileUrl?: string;
  notes?: string;
}

export interface LoanNote {
  id: string;
  loanId: string;
  text: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role?: 'MASTER' | 'USER';
  createdAt: string;
}

export interface Loan {
  id: string;
  userId?: string;
  name: string;
  lender: string;
  loanType: LoanType;
  customType?: string;
  accountNumber: string;
  
  // Financial specifics
  originalAmount: number;
  disbursedAmount: number;
  outstandingPrincipal: number;
  interestRate: number; // annual percentage e.g. 10.5
  interestType: InterestType;
  
  // Repayment parameters
  tenureMonths: number;
  startDate: string; // YYYY-MM-DD
  firstEmiDate: string; // YYYY-MM-DD
  emiAmount: number;
  emiFrequency: EMIFrequency;
  emiDueDay: number; // 1-31
  
  // Calculated state
  totalEmis: number;
  emisPaid: number;
  emisRemaining: number;
  nextEmiDate: string; // YYYY-MM-DD or empty if closed
  nextEmiAmount: number;
  expectedClosureDate: string; // YYYY-MM-DD
  
  // Fees
  processingFee: number;
  otherCharges: number;
  
  // Totals
  totalInterest: number;
  totalPayableAmount: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  
  status: LoanStatus;
  notes?: string;
  calculationSource: 'USER_ENTERED' | 'SYSTEM_CALCULATED' | 'ESTIMATED';
  
  isArchived?: boolean;
  closedDate?: string;
  closureNotes?: string;
  isDemo?: boolean;
  
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entity: 'LOAN' | 'PAYMENT' | 'PREPAYMENT' | 'DOCUMENT' | 'SETTINGS' | 'SYSTEM';
  entityId: string;
  details: string;
  previousValue?: string;
  newValue?: string;
}

export interface UserSettings {
  currency: string;
  currencySymbol: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  reminderDays: number[]; // e.g. [7, 3, 1, 0]
  isDarkMode: boolean;
  userName?: string;
  isAppLockEnabled?: boolean;
  securityPin?: string;
  autoLockOnBackground?: boolean;
  userProfile?: {
    name: string;
    mobile: string;
    email: string;
    address: string;
  };
}

export interface DashboardMetrics {
  totalLoans: number;
  totalOutstanding: number;
  totalMonthlyEmi: number;
  nextEmiDue: {
    loanId: string;
    loanName: string;
    lender: string;
    amount: number;
    dueDate: string;
    daysRemaining: number;
  } | null;
  emisDueThisMonth: number;
  overdueAmount: number;
  overdueCount: number;
  activeLoansCount: number;
  closedLoansCount: number;
  totalPrincipalBorrowed: number;
  totalPrincipalRepaid: number;
  totalInterestPaid: number;
  totalInterestRemaining: number;
  overallRepaymentProgress: number; // percentage 0-100
  earliestUpcomingEmiDate: string | null;
  latestClosureDate: string | null;

  // Unified Commitment metrics
  totalDepositBalance: number;
  totalMonthlyDeposit: number;
  totalMonthlyCommitment: number;
  activeDepositsCount: number;
  maturedDepositsCount: number;
  depositsMaturingSoonCount: number;
  netFinancialPosition: number; // Assets (Deposits) - Liabilities (Loan Outstanding)
}

// ==========================================
// DEPOSIT & SAVINGS COMMITMENT MODULE TYPES
// ==========================================

export type DepositType = 'RD' | 'FD' | 'MONTHLY_SAVINGS' | 'SAVINGS_GOAL' | 'OTHER';

export type DepositStatus = 'ACTIVE' | 'MATURED' | 'CLOSED';

export type DepositContributionStatus =
  | 'UPCOMING'
  | 'DUE_TODAY'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'SKIPPED'
  | 'COMPLETED';

export interface DepositContribution {
  id: string;
  depositId: string;
  contributionNo: number;
  dueDate: string; // YYYY-MM-DD
  scheduledAmount: number;
  paidAmount: number;
  paymentDate?: string; // YYYY-MM-DD
  interestEarned: number;
  cumulativeDeposit: number;
  status: DepositContributionStatus;
  notes?: string;
  payments?: DepositPayment[];
}

export interface DepositPayment {
  id: string;
  depositId: string;
  contributionNo: number;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: string;
  transactionRef?: string;
  notes?: string;
  createdAt: string;
}

export interface Deposit {
  id: string;
  userId?: string;
  name: string;
  institution: string; // Bank or financial institution
  depositType: DepositType;
  customType?: string;
  accountNumber: string; // Account or Reference Number

  // Principal / Starting Amount (Principal for FD, or starting balance for Savings/RD)
  principalAmount: number;
  // Monthly commitment amount (0 for standard FD)
  monthlyContribution: number;

  interestRate: number; // Annual % e.g. 7.1
  interestType: 'COMPOUNDING' | 'SIMPLE' | 'NONE';
  compoundingFrequency?: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

  startDate: string; // YYYY-MM-DD
  contributionStartDate?: string; // YYYY-MM-DD
  contributionFrequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';
  tenureMonths: number;

  totalContributions: number;
  contributionsPaid: number;
  contributionsRemaining: number;
  totalAmountDeposited: number;
  interestEarned: number;

  nextContributionDate?: string; // YYYY-MM-DD
  nextContributionAmount?: number;
  maturityDate: string; // YYYY-MM-DD
  expectedMaturityAmount: number; // Estimated or Overridden
  isMaturityOverridden?: boolean;
  actualMaturityAmount?: number;

  targetAmount?: number; // For Savings Goal
  nominee?: string;
  notes?: string;
  status: DepositStatus;
  isArchived?: boolean;
  isDemo?: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  userId?: string;
  name: string;
  institution?: string;
  targetAmount: number;
  currentSaved: number;
  monthlyContribution: number;
  startDate: string;
  targetDate: string;
  notes?: string;
  status: 'ACTIVE' | 'ACHIEVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedUpcomingItem {
  id: string;
  sourceId: string; // loanId or depositId
  name: string;
  entityName: string; // lender or institution
  accountNumber: string;
  category: 'LOAN_EMI' | 'DEPOSIT_CONTRIBUTION' | 'SAVINGS_CONTRIBUTION';
  itemType: string; // e.g. 'Personal Loan' or 'Recurring Deposit (RD)'
  paymentNo: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  daysRemaining: number;
  status: string;
}

export interface MonthlyCommitmentSummary {
  totalLoanEmi: number;
  totalDepositContribution: number;
  totalMonthlyCommitment: number;
  activeLoansCount: number;
  activeDepositsCount: number;
}

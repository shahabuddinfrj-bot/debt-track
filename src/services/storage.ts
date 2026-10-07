import { pushToSupabase, pullFromSupabase } from './supabaseClient';
import {
  AuditLog,
  AuthUser,
  DashboardMetrics,
  EMIScheduleItem,
  Loan,
  LoanDocument,
  LoanNote,
  PaymentTransaction,
  Prepayment,
  UserSettings,
  UnifiedUpcomingItem,
} from '../types/loan';
import {
  Deposit,
  DepositScheduleItem,
  DepositTransaction,
} from '../types/deposit';
import {
  calculateEMI,
  generateAmortizationSchedule,
  recalculateScheduleWithPrepayment,
} from '../utils/financialCalculations';
import { getDaysDifference } from '../utils/formatters';
import {
  calculateCentralizedOverdue,
  CentralizedOverdueResult,
} from '../utils/overdueCalculator';

export const MASTER_USER: AuthUser = {
  id: 'user_master_shahabuddin',
  name: 'शाहबुद्दीन (Shahabuddin)',
  email: 'shahabuddin.frj@gmail.com',
  password: 'admin123',
  role: 'MASTER',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const STORAGE_KEYS = {
  LOANS: 'debttrack_loans_v1',
  SCHEDULES: 'debttrack_schedules_v1',
  DOCUMENTS: 'debttrack_documents_v1',
  NOTES: 'debttrack_notes_v1',
  AUDIT: 'debttrack_audit_v1',
  SETTINGS: 'debttrack_settings_v1',
  USERS: 'debttrack_users_v1',
  CURRENT_USER: 'debttrack_current_user_v1',
  DEPOSITS: 'debttrack_deposits_v1',
  DEPOSIT_SCHEDULES: 'debttrack_deposit_schedules_v1',
  DEPOSIT_TRANSACTIONS: 'debttrack_deposit_transactions_v1',
};

export const CURRENT_DATE_STR = new Date().toISOString().slice(0, 10);

export const MASTER_PROFILE: NonNullable<UserSettings['userProfile']> = {
  name: 'शाहबुद्दीन (Shahabuddin)',
  mobile: '9042233122',
  email: 'shahabuddin.frj@gmail.com',
  address: 'No. 72, 6th Cross, JJ Nagar, Moolakulam, Pondicherry - 605010',
};

const DEFAULT_SETTINGS: UserSettings = {
  currency: 'INR',
  currencySymbol: '₹',
  dateFormat: 'DD/MM/YYYY',
  reminderDays: [7, 3, 1, 0],
  isDarkMode: false,
  userName: '',
  isAppLockEnabled: false,
  securityPin: '',
  autoLockOnBackground: true,
  userProfile: {
    name: '',
    mobile: '',
    email: '',
    address: '',
  },
};

// Standardize any date string to YYYY-MM-DD
function normalizeDateStr(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return dateStr.slice(0, 10);
}

class StorageService {
  private get<T>(key: string, defaultValue: T): T {
    try {
      if (typeof localStorage === 'undefined') return defaultValue;
      const data = localStorage.getItem(key);
      if (!data) return defaultValue;
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  public async pushToServer(): Promise<void> {
    try {
      const payload = {
        loans: this.get(STORAGE_KEYS.LOANS, []),
        schedules: this.get(STORAGE_KEYS.SCHEDULES, {}),
        documents: this.get(STORAGE_KEYS.DOCUMENTS, []),
        notes: this.get(STORAGE_KEYS.NOTES, []),
        audit: this.get(STORAGE_KEYS.AUDIT, []),
        settings: this.get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
        deposits: this.get(STORAGE_KEYS.DEPOSITS, []),
        depositSchedules: this.get(STORAGE_KEYS.DEPOSIT_SCHEDULES, {}),
        depositTransactions: this.get(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, []),
      };
      await pushToSupabase(this.get<AuthUser | null>(STORAGE_KEYS.CURRENT_USER, MASTER_USER)?.id || MASTER_USER.id, payload);
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}
  }

  public async pullFromServer(): Promise<boolean> {
    try {
      const cloudData = await pullFromSupabase(this.get<AuthUser | null>(STORAGE_KEYS.CURRENT_USER, MASTER_USER)?.id || MASTER_USER.id);
      if (cloudData && cloudData.loans && Array.isArray(cloudData.loans)) {
        this.set(STORAGE_KEYS.LOANS, cloudData.loans);
        if (cloudData.schedules) this.set(STORAGE_KEYS.SCHEDULES, cloudData.schedules);
        if (cloudData.documents) this.set(STORAGE_KEYS.DOCUMENTS, cloudData.documents);
        if (cloudData.notes) this.set(STORAGE_KEYS.NOTES, cloudData.notes);
        if (cloudData.settings) this.set(STORAGE_KEYS.SETTINGS, cloudData.settings);
        if (cloudData.deposits) this.set(STORAGE_KEYS.DEPOSITS, cloudData.deposits);
        return true;
      }
    } catch {}
    return false;
  }

  public getSettings(): UserSettings {
    const s = this.get<UserSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...s, userProfile: s.userProfile || DEFAULT_SETTINGS.userProfile };
  }

  public saveSettings(settings: UserSettings): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  public getUsers(): AuthUser[] {
    const users = this.get<AuthUser[]>(STORAGE_KEYS.USERS, []);
    if (!users.some((u) => u.email.toLowerCase() === MASTER_USER.email.toLowerCase())) {
      users.unshift(MASTER_USER);
      this.set(STORAGE_KEYS.USERS, users);
    }
    return users;
  }

  private impersonatedUser: AuthUser | null = null;

  public getRealUser(): AuthUser | null {
    return this.get<AuthUser | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  public getCurrentUser(): AuthUser | null {
    return this.impersonatedUser || this.getRealUser();
  }

  public setImpersonatedUser(user: AuthUser | null): void {
    this.impersonatedUser = user;
  }

  public getImpersonatedUser(): AuthUser | null {
    return this.impersonatedUser;
  }

  public isImpersonating(): boolean {
    return !!this.impersonatedUser;
  }

  public isMasterAdmin(): boolean {
    const realUser = this.getRealUser();
    return !!realUser && realUser.email.toLowerCase() === MASTER_USER.email.toLowerCase();
  }

  public setCurrentUser(user: AuthUser): void {
    this.impersonatedUser = null;
    this.set(STORAGE_KEYS.CURRENT_USER, user);
  }

  public getSecurityPin(): string {
    return this.getSettings().securityPin || '';
  }

  public getLoans(includeArchived: boolean = false): Loan[] {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return [];
    const allLoans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const userLoans = allLoans.filter((l) => {
      if (currentUser.id === MASTER_USER.id) {
        return (l.userId || MASTER_USER.id) === MASTER_USER.id;
      }
      return l.userId === currentUser.id;
    });
    return includeArchived ? userLoans : userLoans.filter((l) => !l.isArchived);
  }

  public getLoanById(id: string): Loan | null {
    const loans = this.getLoans(true);
    return loans.find((l) => l.id === id) || null;
  }

  public saveLoan(loan: Loan, schedule: EMIScheduleItem[]): void {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;
    loan.userId = currentUser.id;
    const loans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const idx = loans.findIndex((l) => l.id === loan.id);
    if (idx >= 0) {
      loans[idx] = { ...loan, updatedAt: new Date().toISOString() };
    } else {
      loans.push(loan);
    }
    this.set(STORAGE_KEYS.LOANS, loans);
    const allSchedules = this.get<Record<string, EMIScheduleItem[]>>(STORAGE_KEYS.SCHEDULES, {});
    allSchedules[loan.id] = schedule;
    this.set(STORAGE_KEYS.SCHEDULES, allSchedules);
    this.pushToServer();
  }

  public getSchedule(loanId: string): EMIScheduleItem[] {
    const allSchedules = this.get<Record<string, EMIScheduleItem[]>>(STORAGE_KEYS.SCHEDULES, {});
    return allSchedules[loanId] || [];
  }

  public getUnifiedUpcomingPayments(): UnifiedUpcomingItem[] {
    try {
      const items: UnifiedUpcomingItem[] = [];
      const today = normalizeDateStr(new Date().toISOString().slice(0, 10));

      for (const loan of this.getLoans(false)) {
        if (loan.status === 'CLOSED') continue;
        for (const emi of this.getSchedule(loan.id)) {
          if (emi.status === 'PAID') continue;
          const normDueDate = normalizeDateStr(emi.dueDate);
          const daysDiff = getDaysDifference(normDueDate, today);
          items.push({
            id: `loan-emi-${loan.id}-${emi.paymentNo}`,
            category: 'LOAN_EMI',
            sourceId: loan.id,
            name: loan.name,
            entityName: loan.lender,
            itemType: loan.loanType,
            accountNumber: loan.accountNumber,
            paymentNo: emi.paymentNo,
            dueDate: emi.dueDate,
            amount: emi.emiAmount,
            remainingAmount: Math.max(0, emi.emiAmount - (emi.paidAmount || 0)),
            daysRemaining: daysDiff,
          });
        }
      }

      for (const dep of this.getDeposits(false)) {
        if (dep.status === 'CLOSED' || dep.status === 'MATURED') continue;
        for (const item of this.getDepositSchedule(dep.id)) {
          if (item.status === 'PAID') continue;
          const normDueDate = normalizeDateStr(item.dueDate);
          const daysDiff = getDaysDifference(normDueDate, today);
          items.push({
            id: `dep-contrib-${dep.id}-${item.installmentNumber}`,
            category: 'DEPOSIT_CONTRIBUTION',
            sourceId: dep.id,
            name: dep.name,
            entityName: dep.institutionName || 'Deposit Account',
            itemType: dep.type,
            accountNumber: dep.accountNumber,
            paymentNo: item.installmentNumber,
            dueDate: item.dueDate,
            amount: item.expectedAmount,
            remainingAmount: Math.max(0, item.expectedAmount - (item.paidAmount || 0)),
            daysRemaining: daysDiff,
          });
        }
      }

      items.sort((a, b) => normalizeDateStr(a.dueDate).localeCompare(normalizeDateStr(b.dueDate)));
      return items;
    } catch {
      return [];
    }
  }

  public recordPayment(loanId: string, paymentNo: number, transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'loanId' | 'emiPaymentNo'>): { success: boolean; error?: string } {
    const loan = this.getLoanById(loanId);
    if (!loan) return { success: false, error: 'Loan not found' };
    const schedule = this.getSchedule(loanId);
    const emiItem = schedule.find((s) => s.paymentNo === paymentNo);
    if (!emiItem) return { success: false, error: 'EMI installment not found' };

    const paymentId = 'pay_' + Date.now();
    emiItem.payments = emiItem.payments || [];
    emiItem.payments.push({ ...transaction, id: paymentId, loanId, emiPaymentNo: paymentNo, createdAt: new Date().toISOString() });
    emiItem.paidAmount = emiItem.payments.reduce((s, p) => s + p.amountPaid, 0);
    emiItem.actualPaymentDate = transaction.paymentDate;
    emiItem.status = emiItem.paidAmount >= emiItem.emiAmount - 0.5 ? 'PAID' : 'PARTIAL';

    this.recalculateLoanMetrics(loan, schedule);
    this.saveLoan(loan, schedule);
    return { success: true };
  }

  public undoPayment(loanId: string, paymentNo: number): { success: boolean; error?: string } {
    const loan = this.getLoanById(loanId);
    if (!loan) return { success: false, error: 'Loan not found' };
    const schedule = this.getSchedule(loanId);
    const emiItem = schedule.find((s) => s.paymentNo === paymentNo);
    if (!emiItem) return { success: false, error: 'EMI installment not found' };

    emiItem.payments = [];
    emiItem.paidAmount = 0;
    emiItem.actualPaymentDate = undefined;
    const today = normalizeDateStr(new Date().toISOString().slice(0, 10));
    emiItem.status = getDaysDifference(normalizeDateStr(emiItem.dueDate), today) < 0 ? 'OVERDUE' : 'PENDING';

    this.recalculateLoanMetrics(loan, schedule);
    this.saveLoan(loan, schedule);
    return { success: true };
  }

  // Deposits Support
  public getDeposits(includeClosed: boolean = true): Deposit[] {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return [];
    const all = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
    const userDeps = all.filter((d) => (currentUser.id === MASTER_USER.id ? (d.userId || MASTER_USER.id) === MASTER_USER.id : d.userId === currentUser.id));
    return includeClosed ? userDeps : userDeps.filter((d) => d.status !== 'CLOSED');
  }

  public getDeposit(id: string): Deposit | null {
    return this.getDeposits(true).find((d) => d.id === id) || null;
  }

  public saveDeposit(deposit: Deposit, schedule?: DepositScheduleItem[]): void {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;
    deposit.userId = currentUser.id;
    const deposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
    const idx = deposits.findIndex((d) => d.id === deposit.id);
    if (idx >= 0) deposits[idx] = { ...deposit, updatedAt: new Date().toISOString() };
    else deposits.push(deposit);
    this.set(STORAGE_KEYS.DEPOSITS, deposits);
    if (schedule) {
      const allSchedules = this.get<Record<string, DepositScheduleItem[]>>(STORAGE_KEYS.DEPOSIT_SCHEDULES, {});
      allSchedules[deposit.id] = schedule;
      this.set(STORAGE_KEYS.DEPOSIT_SCHEDULES, allSchedules);
    }
    this.pushToServer();
  }

  public getDepositSchedule(depositId: string): DepositScheduleItem[] {
    const all = this.get<Record<string, DepositScheduleItem[]>>(STORAGE_KEYS.DEPOSIT_SCHEDULES, {});
    return all[depositId] || [];
  }

  public undoDepositPayment(depositId: string, installmentNumber: number): { success: boolean; error?: string } {
    const dep = this.getDeposit(depositId);
    if (!dep) return { success: false, error: 'Deposit not found' };
    const schedule = this.getDepositSchedule(depositId);
    const item = schedule.find((s) => s.installmentNumber === installmentNumber);
    if (!item) return { success: false, error: 'Installment not found' };

    const removedAmt = item.paidAmount || 0;
    item.paidAmount = 0;
    item.paidDate = undefined;
    item.status = 'PENDING';

    dep.currentBalance = Math.max(0, (dep.currentBalance || 0) - removedAmt);
    dep.totalContributionsPaid = Math.max(0, (dep.totalContributionsPaid || 0) - removedAmt);

    this.saveDeposit(dep, schedule);
    return { success: true };
  }

  public getDocuments(loanId?: string): LoanDocument[] {
    const docs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    return loanId ? docs.filter((d) => d.loanId === loanId) : docs;
  }
  public saveDocument(doc: LoanDocument): void {
    const docs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    docs.push(doc);
    this.set(STORAGE_KEYS.DOCUMENTS, docs);
    this.pushToServer();
  }
  public deleteDocument(docId: string): void {
    this.set(STORAGE_KEYS.DOCUMENTS, this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []).filter((d) => d.id !== docId));
    this.pushToServer();
  }
  public getNotes(loanId: string): LoanNote[] {
    return this.get<LoanNote[]>(STORAGE_KEYS.NOTES, []).filter((n) => n.loanId === loanId);
  }
  public addNote(loanId: string, text: string): void {
    const notes = this.get<LoanNote[]>(STORAGE_KEYS.NOTES, []);
    notes.unshift({ id: 'note_' + Date.now(), loanId, text, createdAt: new Date().toISOString() });
    this.set(STORAGE_KEYS.NOTES, notes);
    this.pushToServer();
  }
  public getAuditLogs(): AuditLog[] {
    return this.get<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
  }

  private recalculateLoanMetrics(loan: Loan, schedule: EMIScheduleItem[]): void {
    let totalPrincipalPaid = 0;
    let totalInterestPaid = 0;
    let emisPaidCount = 0;
    let nextEmi: EMIScheduleItem | null = null;
    let hasOverdue = false;
    const today = normalizeDateStr(new Date().toISOString().slice(0, 10));

    for (const item of schedule) {
      if (item.status === 'PAID') {
        emisPaidCount++;
        totalPrincipalPaid += item.principalComponent;
        totalInterestPaid += item.interestComponent;
      } else {
        const itemDate = normalizeDateStr(item.dueDate);
        const diff = getDaysDifference(itemDate, today);
        if (diff < 0) {
          item.status = 'OVERDUE';
          hasOverdue = true;
        } else {
          item.status = 'PENDING';
        }
        if (!nextEmi) nextEmi = item;
      }
    }

    loan.emisPaid = emisPaidCount;
    loan.emisRemaining = Math.max(0, schedule.length - emisPaidCount);
    loan.totalPrincipalPaid = Number(totalPrincipalPaid.toFixed(2));
    loan.totalInterestPaid = Number(totalInterestPaid.toFixed(2));
    loan.outstandingPrincipal = Math.max(0, Number((loan.originalAmount - totalPrincipalPaid).toFixed(2)));
    loan.nextEmiDate = nextEmi ? nextEmi.dueDate : '';
    loan.nextEmiAmount = nextEmi ? nextEmi.emiAmount - (nextEmi.paidAmount || 0) : 0;
    loan.status = loan.outstandingPrincipal <= 0 ? 'CLOSED' : hasOverdue ? 'OVERDUE' : 'ACTIVE';
  }

  // Dashboard Metrics: Unpaid commitments me se sabse pehli Next EMI dhoondhna
  public getDashboardMetrics(): DashboardMetrics {
    const loans = this.getLoans(false);
    const activeLoans = loans.filter((l) => l.status !== 'CLOSED');
    const closedLoans = loans.filter((l) => l.status === 'CLOSED');

    let totalOutstanding = 0;
    let totalMonthlyEmi = 0;
    let totalPrincipalBorrowed = 0;
    let totalPrincipalRepaid = 0;
    let totalInterestPaid = 0;
    let totalInterestRemaining = 0;
    let emisDueThisMonth = 0;
    const today = normalizeDateStr(new Date().toISOString().slice(0, 10));
    const currentYearMonth = today.substring(0, 7);

    const pendingCommitments: Array<{
      loanId: string;
      loanName: string;
      lender: string;
      amount: number;
      dueDate: string;
      daysRemaining: number;
      normDate: string;
    }> = [];

    for (const loan of activeLoans) {
      totalOutstanding += loan.outstandingPrincipal;
      totalMonthlyEmi += loan.emiAmount;
      totalPrincipalBorrowed += loan.originalAmount;
      totalPrincipalRepaid += loan.totalPrincipalPaid;
      totalInterestPaid += loan.totalInterestPaid;
      totalInterestRemaining += Math.max(0, loan.totalInterest - loan.totalInterestPaid);

      for (const item of this.getSchedule(loan.id)) {
        if (item.status === 'PAID') continue;
        const normDueDate = normalizeDateStr(item.dueDate);
        const diff = getDaysDifference(normDueDate, today);

        if (normDueDate.substring(0, 7) === currentYearMonth) {
          emisDueThisMonth++;
        }

        pendingCommitments.push({
          loanId: loan.id,
          loanName: loan.name,
          lender: loan.lender,
          amount: Math.max(0, item.emiAmount - (item.paidAmount || 0)),
          dueDate: item.dueDate,
          daysRemaining: diff,
          normDate: normDueDate,
        });
      }
    }

    // Sort by Normalized Date
    pendingCommitments.sort((a, b) => a.normDate.localeCompare(b.normDate));

    let nearestNextEmi: DashboardMetrics['nextEmiDue'] = null;
    const nextItem = pendingCommitments.find((c) => c.daysRemaining >= 0) || pendingCommitments[0];
    if (nextItem) {
      nearestNextEmi = {
        loanId: nextItem.loanId,
        loanName: nextItem.loanName,
        lender: nextItem.lender,
        amount: nextItem.amount,
        dueDate: nextItem.dueDate,
        daysRemaining: nextItem.daysRemaining,
      };
    }

    for (const loan of closedLoans) {
      totalPrincipalBorrowed += loan.originalAmount;
      totalPrincipalRepaid += loan.totalPrincipalPaid || loan.originalAmount;
      totalInterestPaid += loan.totalInterestPaid;
    }

    const overallProgress = totalPrincipalBorrowed > 0 ? Math.min(100, Number(((totalPrincipalRepaid / totalPrincipalBorrowed) * 100).toFixed(1))) : 0;

    return {
      totalLoans: loans.length,
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      totalMonthlyEmi: Number(totalMonthlyEmi.toFixed(2)),
      nextEmiDue: nearestNextEmi,
      emisDueThisMonth,
      overdueAmount: 0,
      overdueCount: 0,
      activeLoansCount: activeLoans.length,
      closedLoansCount: closedLoans.length,
      totalPrincipalBorrowed: Number(totalPrincipalBorrowed.toFixed(2)),
      totalPrincipalRepaid: Number(totalPrincipalRepaid.toFixed(2)),
      totalInterestPaid: Number(totalInterestPaid.toFixed(2)),
      totalInterestRemaining: Number(totalInterestRemaining.toFixed(2)),
      overallRepaymentProgress: overallProgress,
      earliestUpcomingEmiDate: nearestNextEmi ? nearestNextEmi.dueDate : null,
      latestClosureDate: null,
    };
  }

  public exportBackup(): string { return ''; }
  public restoreBackup(): { success: boolean } { return { success: true }; }
  public loadDemoData(): void {}
  public clearDemoData(): void {}
  public clearAllData(): void {}
}

export const storageService = new StorageService();

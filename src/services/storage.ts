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

// Today's dynamic reference date
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

class StorageService {
  private get<T>(key: string, defaultValue: T): T {
    try {
      if (typeof localStorage === 'undefined') return defaultValue;
      const data = localStorage.getItem(key);
      if (!data) return defaultValue;
      return JSON.parse(data);
    } catch (e) {
      console.error(`Failed to parse storage key ${key}:`, e);
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to save to storage key ${key}:`, e);
    }
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
    } catch (e) {
      // Offline fallback
    }
  }

  public async pullFromServer(): Promise<boolean> {
    try {
      const cloudData = await pullFromSupabase(this.get<AuthUser | null>(STORAGE_KEYS.CURRENT_USER, MASTER_USER)?.id || MASTER_USER.id);
      if (cloudData) {
        if (cloudData.loans && Array.isArray(cloudData.loans) && cloudData.loans.length > 0) {
          this.set(STORAGE_KEYS.LOANS, cloudData.loans);
          if (cloudData.schedules) this.set(STORAGE_KEYS.SCHEDULES, cloudData.schedules);
          if (cloudData.documents) this.set(STORAGE_KEYS.DOCUMENTS, cloudData.documents);
          if (cloudData.notes) this.set(STORAGE_KEYS.NOTES, cloudData.notes);
          if (cloudData.settings) this.set(STORAGE_KEYS.SETTINGS, cloudData.settings);
          if (cloudData.deposits) this.set(STORAGE_KEYS.DEPOSITS, cloudData.deposits);
          return true;
        }
      }
      const res = await fetch('/api/sync', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data && data.loans && Array.isArray(data.loans)) {
        const localLoans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);

        if (data.loans.length === 0 && localLoans.length > 0) {
          await this.pushToServer();
          return true;
        }

        if (data.loans.length > 0) {
          const serverHasRealLoans = data.loans.some((l: Loan) => !l.isDemo);
          const localHasRealLoans = localLoans.some((l: Loan) => !l.isDemo);

          let mergedLoans: Loan[] = [];

          if (localHasRealLoans && !serverHasRealLoans) {
            mergedLoans = localLoans.filter((l: Loan) => !l.isDemo);
            this.set(STORAGE_KEYS.LOANS, mergedLoans);
            await this.pushToServer();
            return true;
          } else if (serverHasRealLoans) {
            const loanMap = new Map<string, Loan>();
            data.loans.filter((l: Loan) => !l.isDemo).forEach((l: Loan) => loanMap.set(l.id, l));
            localLoans.filter((l: Loan) => !l.isDemo).forEach((l: Loan) => {
              if (!loanMap.has(l.id)) loanMap.set(l.id, l);
            });
            mergedLoans = Array.from(loanMap.values());
            this.set(STORAGE_KEYS.LOANS, mergedLoans);
          } else {
            const loanMap = new Map<string, Loan>();
            localLoans.forEach((l: Loan) => loanMap.set(l.id, l));
            data.loans.forEach((l: Loan) => loanMap.set(l.id, l));
            mergedLoans = Array.from(loanMap.values());
            this.set(STORAGE_KEYS.LOANS, mergedLoans);
          }

          const localSchedules = this.get<Record<string, EMIScheduleItem[]>>(STORAGE_KEYS.SCHEDULES, {});
          const mergedSchedules = { ...localSchedules, ...(data.schedules || {}) };
          this.set(STORAGE_KEYS.SCHEDULES, mergedSchedules);

          if (data.documents && Array.isArray(data.documents)) {
            const localDocs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
            const docMap = new Map<string, LoanDocument>();
            localDocs.forEach((d: LoanDocument) => docMap.set(d.id, d));
            data.documents.forEach((d: LoanDocument) => docMap.set(d.id, d));
            this.set(STORAGE_KEYS.DOCUMENTS, Array.from(docMap.values()));
          }

          if (data.notes && Array.isArray(data.notes)) {
            const localNotes = this.get<LoanNote[]>(STORAGE_KEYS.NOTES, []);
            const noteMap = new Map<string, LoanNote>();
            localNotes.forEach((n: LoanNote) => noteMap.set(n.id, n));
            data.notes.forEach((n: LoanNote) => noteMap.set(n.id, n));
            this.set(STORAGE_KEYS.NOTES, Array.from(noteMap.values()));
          }

          if (data.deposits && Array.isArray(data.deposits)) {
            const localDeposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
            const depositMap = new Map<string, Deposit>();
            data.deposits.forEach((d: Deposit) => depositMap.set(d.id, d));
            localDeposits.forEach((d: Deposit) => {
              if (!depositMap.has(d.id)) depositMap.set(d.id, d);
            });
            this.set(STORAGE_KEYS.DEPOSITS, Array.from(depositMap.values()));
          }

          if (data.depositSchedules && typeof data.depositSchedules === 'object') {
            const localDepSchedules = this.get<Record<string, DepositScheduleItem[]>>(STORAGE_KEYS.DEPOSIT_SCHEDULES, {});
            this.set(STORAGE_KEYS.DEPOSIT_SCHEDULES, { ...localDepSchedules, ...data.depositSchedules });
          }

          if (data.depositTransactions && Array.isArray(data.depositTransactions)) {
            const localDepTxs = this.get<DepositTransaction[]>(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, []);
            const txMap = new Map<string, DepositTransaction>();
            data.depositTransactions.forEach((t: DepositTransaction) => txMap.set(t.id, t));
            localDepTxs.forEach((t: DepositTransaction) => {
              if (!txMap.has(t.id)) txMap.set(t.id, t);
            });
            this.set(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, Array.from(txMap.values()));
          }

          if (mergedLoans.length > data.loans.length) {
            await this.pushToServer();
          }

          return true;
        } else if (localLoans.length > 0) {
          await this.pushToServer();
          return true;
        }
      } else {
        const localLoans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
        if (localLoans.length > 0) {
          await this.pushToServer();
          return true;
        }
      }
    } catch (e) {
      // Offline fallback
    }
    return false;
  }

  // Settings
  public getSettings(): UserSettings {
    const s = this.get<UserSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      userProfile: s.userProfile || DEFAULT_SETTINGS.userProfile,
    };
  }

  public saveSettings(settings: UserSettings): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
    this.logAudit({
      action: 'SETTINGS_UPDATED',
      entity: 'SETTINGS',
      entityId: 'user_settings',
      details: 'Updated currency and application preferences',
    });
  }

  // Users & Session
  public getUsers(): AuthUser[] {
    const users = this.get<AuthUser[]>(STORAGE_KEYS.USERS, []);
    const masterIdx = users.findIndex(
      (u) => u.email.toLowerCase() === MASTER_USER.email.toLowerCase()
    );
    if (masterIdx === -1) {
      users.unshift(MASTER_USER);
      this.set(STORAGE_KEYS.USERS, users);
    } else {
      if (users[masterIdx].password !== MASTER_USER.password) {
        users[masterIdx].password = MASTER_USER.password;
        this.set(STORAGE_KEYS.USERS, users);
      }
    }
    return users;
  }

  private impersonatedUser: AuthUser | null = null;

  public getRealUser(): AuthUser | null {
    return this.get<AuthUser | null>(STORAGE_KEYS.CURRENT_USER, null);
  }

  public getCurrentUser(): AuthUser | null {
    if (this.impersonatedUser) {
      return this.impersonatedUser;
    }
    return this.getRealUser();
  }

  public setImpersonatedUser(user: AuthUser | null): void {
    this.impersonatedUser = user;
    if (user) {
      this.logAudit({
        action: 'ADMIN_IMPERSONATION_STARTED',
        entity: 'SYSTEM',
        entityId: user.id,
        details: `Master Admin inspected user: ${user.name} (${user.email})`,
      });
    } else {
      this.logAudit({
        action: 'ADMIN_IMPERSONATION_ENDED',
        entity: 'SYSTEM',
        entityId: 'admin',
        details: 'Master Admin exited troubleshoot mode',
      });
    }
  }

  public getImpersonatedUser(): AuthUser | null {
    return this.impersonatedUser;
  }

  public isImpersonating(): boolean {
    return !!this.impersonatedUser;
  }

  public isMasterAdmin(): boolean {
    const realUser = this.getRealUser();
    if (!realUser) return false;
    return realUser.email.toLowerCase() === MASTER_USER.email.toLowerCase();
  }

  public getUserLoansCount(userId: string): number {
    const allLoans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    return allLoans.filter((l) => {
      if (userId === MASTER_USER.id) {
        return l.userId === MASTER_USER.id || !l.userId;
      }
      return l.userId === userId;
    }).length;
  }

  public setCurrentUser(user: AuthUser): void {
    this.impersonatedUser = null;
    this.set(STORAGE_KEYS.CURRENT_USER, user);
    this.logAudit({
      action: 'USER_LOGIN',
      entity: 'SYSTEM',
      entityId: user.id,
      details: `User session active: ${user.name} (${user.email})`,
    });
  }

  public registerUser(
    name: string,
    email: string,
    password: string
  ): { success: boolean; user?: AuthUser; error?: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const users = this.getUsers();

    if (!name.trim()) return { success: false, error: 'Full Name is required' };
    if (!normalizedEmail || !normalizedEmail.includes('@'))
      return { success: false, error: 'Valid email address is required' };
    if (!password || password.length < 4)
      return { success: false, error: 'Password must be at least 4 characters' };

    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return { success: false, error: 'An account with this email already exists' };
    }

    const newUser: AuthUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'USER',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.set(STORAGE_KEYS.USERS, users);
    this.setCurrentUser(newUser);

    this.logAudit({
      action: 'USER_REGISTERED',
      entity: 'SYSTEM',
      entityId: newUser.id,
      details: `New account registered: ${newUser.name} (${newUser.email})`,
    });

    return { success: true, user: newUser };
  }

  public loginUser(
    email: string,
    password: string
  ): { success: boolean; user?: AuthUser; error?: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const users = this.getUsers();

    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      return { success: false, error: 'Account not found with this email' };
    }

    if (user.email.toLowerCase() === MASTER_USER.email.toLowerCase()) {
      if (password !== 'admin123') {
        return { success: false, error: 'Incorrect password for Master Admin' };
      }
      this.setCurrentUser(user);
      return { success: true, user };
    }

    if (user.password && user.password !== password) {
      return { success: false, error: 'Incorrect password' };
    }

    this.setCurrentUser(user);
    return { success: true, user };
  }

  public logoutUser(): void {
    this.impersonatedUser = null;
    this.set(STORAGE_KEYS.CURRENT_USER, null);
  }

  // Profile
  public getUserProfile() {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return {
        name: 'Guest User',
        email: '',
        mobile: '',
        address: '',
      };
    }
    if (currentUser.id === MASTER_USER.id) {
      const settings = this.getSettings();
      if (settings.userProfile && settings.userProfile.email) {
        return settings.userProfile;
      }
      return MASTER_PROFILE;
    }
    const userProfiles = this.get<Record<string, NonNullable<UserSettings['userProfile']>>>(
      'debttrack_user_profiles_v1',
      {}
    );
    return (
      userProfiles[currentUser.id] || {
        name: currentUser.name,
        email: currentUser.email,
        mobile: '',
        address: '',
      }
    );
  }

  public saveUserProfile(profile: NonNullable<UserSettings['userProfile']>): void {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;
    if (currentUser.id === MASTER_USER.id) {
      const settings = this.getSettings();
      settings.userProfile = profile;
      settings.userName = profile.name;
      this.saveSettings(settings);
    } else {
      const userProfiles = this.get<Record<string, NonNullable<UserSettings['userProfile']>>>(
        'debttrack_user_profiles_v1',
        {}
      );
      userProfiles[currentUser.id] = profile;
      this.set('debttrack_user_profiles_v1', userProfiles);
    }
  }

  public getSecurityPin(): string {
    return this.getSettings().securityPin || '';
  }

  public setSecurityPin(pin: string): void {
    const settings = this.getSettings();
    settings.securityPin = pin;
    settings.isAppLockEnabled = true;
    this.saveSettings(settings);
  }

  public toggleAppLock(enabled: boolean): void {
    const settings = this.getSettings();
    settings.isAppLockEnabled = enabled;
    this.saveSettings(settings);
  }

  // Loans
  public getLoans(includeArchived: boolean = false, forUserId?: string): Loan[] {
    const currentUser = this.getCurrentUser();
    const targetUserId = forUserId || currentUser?.id;
    if (!targetUserId) return [];
    const allLoans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);

    const userLoans = allLoans.filter((l) => {
      if (targetUserId === MASTER_USER.id) {
        return (l.userId || MASTER_USER.id) === MASTER_USER.id;
      }
      return l.userId === targetUserId;
    });
    return includeArchived ? userLoans : userLoans.filter((l) => !l.isArchived);
  }

  public getLoanById(id: string): Loan | null {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return null;
    const targetUserId = currentUser.id;
    const allLoans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const found = allLoans.find((l) => l.id === id);
    if (!found) return null;
    if (targetUserId === MASTER_USER.id) {
      if (found.userId && found.userId !== MASTER_USER.id) return null;
    } else {
      if (found.userId !== targetUserId) return null;
    }
    return found;
  }

  public saveLoan(loan: Loan, schedule: EMIScheduleItem[]): void {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;
    loan.userId = currentUser.id;
    const loans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const existingIndex = loans.findIndex((l) => l.id === loan.id);

    if (existingIndex >= 0) {
      loans[existingIndex] = { ...loan, updatedAt: new Date().toISOString() };
    } else {
      loans.push(loan);
    }

    this.set(STORAGE_KEYS.LOANS, loans);

    const allSchedules = this.get<Record<string, EMIScheduleItem[]>>(
      STORAGE_KEYS.SCHEDULES,
      {}
    );
    allSchedules[loan.id] = schedule;
    this.set(STORAGE_KEYS.SCHEDULES, allSchedules);
    this.pushToServer();
  }

  public getSchedule(loanId: string): EMIScheduleItem[] {
    const allSchedules = this.get<Record<string, EMIScheduleItem[]>>(
      STORAGE_KEYS.SCHEDULES,
      {}
    );
    return allSchedules[loanId] || [];
  }

  public archiveLoan(loanId: string): boolean {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;
    const loans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return false;

    loan.isArchived = true;
    loan.updatedAt = new Date().toISOString();
    this.set(STORAGE_KEYS.LOANS, loans);
    this.pushToServer();
    return true;
  }

  public deleteLoanPermanently(loanId: string): boolean {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;
    let loans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    loans = loans.filter((l) => l.id !== loanId);
    this.set(STORAGE_KEYS.LOANS, loans);

    const allSchedules = this.get<Record<string, EMIScheduleItem[]>>(
      STORAGE_KEYS.SCHEDULES,
      {}
    );
    delete allSchedules[loanId];
    this.set(STORAGE_KEYS.SCHEDULES, allSchedules);
    this.pushToServer();
    return true;
  }

  // Unified Upcoming Payments
  public getUnifiedUpcomingPayments(): UnifiedUpcomingItem[] {
    try {
      const items: UnifiedUpcomingItem[] = [];
      const todayStr = new Date().toISOString().slice(0, 10);
      const loans = this.getLoans(false);

      for (const loan of loans) {
        if (loan.status === 'CLOSED') continue;
        const schedule = this.getSchedule(loan.id);

        for (const emi of schedule) {
          if (emi.status === 'PAID') continue;

          const daysDiff = getDaysDifference(emi.dueDate, todayStr);
          const remainingAmount = Math.max(0, emi.emiAmount - (emi.paidAmount || 0));

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
            remainingAmount,
            daysRemaining: daysDiff,
          });
        }
      }

      const deposits = this.getDeposits(false);
      for (const deposit of deposits) {
        if (deposit.status === 'CLOSED' || deposit.status === 'MATURED') continue;
        const depSchedule = this.getDepositSchedule(deposit.id);

        for (const item of depSchedule) {
          if (item.status === 'PAID') continue;

          const daysDiff = getDaysDifference(item.dueDate, todayStr);
          const remainingAmount = Math.max(0, item.expectedAmount - (item.paidAmount || 0));

          items.push({
            id: `dep-contrib-${deposit.id}-${item.installmentNumber}`,
            category: 'DEPOSIT_CONTRIBUTION',
            sourceId: deposit.id,
            name: deposit.name,
            entityName: deposit.institutionName || 'Deposit Account',
            itemType: deposit.type,
            accountNumber: deposit.accountNumber,
            paymentNo: item.installmentNumber,
            dueDate: item.dueDate,
            amount: item.expectedAmount,
            remainingAmount,
            daysRemaining: daysDiff,
          });
        }
      }

      items.sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));
      return items;
    } catch (e) {
      console.error('Failed to compute getUnifiedUpcomingPayments:', e);
      return [];
    }
  }

  // Record Payment
  public recordPayment(
    loanId: string,
    paymentNo: number,
    transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'loanId' | 'emiPaymentNo'>
  ): { success: boolean; error?: string } {
    const loan = this.getLoanById(loanId);
    if (!loan) return { success: false, error: 'Loan not found' };

    const schedule = this.getSchedule(loanId);
    const emiItem = schedule.find((s) => s.paymentNo === paymentNo);
    if (!emiItem) return { success: false, error: 'EMI installment not found' };

    const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const fullTransaction: PaymentTransaction = {
      ...transaction,
      id: paymentId,
      loanId,
      emiPaymentNo: paymentNo,
      createdAt: new Date().toISOString(),
    };

    emiItem.payments = emiItem.payments || [];
    emiItem.payments.push(fullTransaction);

    const totalPaidOnThisEmi = emiItem.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    emiItem.paidAmount = totalPaidOnThisEmi;
    emiItem.actualPaymentDate = transaction.paymentDate;

    if (totalPaidOnThisEmi >= emiItem.emiAmount - 0.5) {
      emiItem.status = 'PAID';
    } else {
      emiItem.status = 'PARTIAL';
    }

    this.recalculateLoanMetricsFromSchedule(loan, schedule);
    this.saveLoan(loan, schedule);

    this.logAudit({
      action: 'PAYMENT_RECORDED',
      entity: 'PAYMENT',
      entityId: paymentId,
      details: `Recorded payment of ₹${transaction.amountPaid} for ${loan.name} (EMI #${paymentNo})`,
    });

    return { success: true };
  }

  // UNDO / REVERT PAYMENT (Agar galti se paid mark ho gaya ho)
  public undoPayment(loanId: string, paymentNo: number): { success: boolean; error?: string } {
    const loan = this.getLoanById(loanId);
    if (!loan) return { success: false, error: 'Loan not found' };

    const schedule = this.getSchedule(loanId);
    const emiItem = schedule.find((s) => s.paymentNo === paymentNo);
    if (!emiItem) return { success: false, error: 'EMI installment not found' };

    // Reset this installment back to pending
    emiItem.payments = [];
    emiItem.paidAmount = 0;
    emiItem.actualPaymentDate = undefined;

    const todayStr = new Date().toISOString().slice(0, 10);
    const diff = getDaysDifference(emiItem.dueDate, todayStr);
    emiItem.status = diff < 0 ? 'OVERDUE' : 'PENDING';

    this.recalculateLoanMetricsFromSchedule(loan, schedule);
    this.saveLoan(loan, schedule);

    this.logAudit({
      action: 'PAYMENT_RECORDED',
      entity: 'PAYMENT',
      entityId: `undo_${loanId}_${paymentNo}`,
      details: `Reverted EMI #${paymentNo} for ${loan.name} back to unpaid`,
    });

    return { success: true };
  }

  // Prepayment
  public recordPrepayment(
    loanId: string,
    prepayment: {
      amount: number;
      date: string;
      type: 'PART_PAYMENT' | 'FORECLOSURE';
      reductionOption: 'REDUCE_EMI' | 'REDUCE_TENURE';
      notes?: string;
    }
  ): { success: boolean; error?: string } {
    const loan = this.getLoanById(loanId);
    if (!loan) return { success: false, error: 'Loan not found' };

    const schedule = this.getSchedule(loanId);
    if (schedule.length === 0) return { success: false, error: 'Schedule not found' };

    const newSchedule = recalculateScheduleWithPrepayment(
      schedule,
      prepayment.date,
      prepayment.amount,
      prepayment.reductionOption,
      loan.interestRate,
      loan.interestType,
      loan.emiFrequency
    );

    if (prepayment.type === 'FORECLOSURE' || newSchedule.every((s) => s.status === 'PAID')) {
      loan.status = 'CLOSED';
      loan.closedDate = prepayment.date;
      loan.closureNotes = prepayment.notes || 'Full foreclosure payment completed';
      loan.outstandingPrincipal = 0;
      loan.emisRemaining = 0;
      loan.nextEmiDate = '';
      loan.nextEmiAmount = 0;
    } else {
      this.recalculateLoanMetricsFromSchedule(loan, newSchedule);
    }

    this.saveLoan(loan, newSchedule);
    return { success: true };
  }

  public closeLoan(loanId: string, closureDate: string, closureNotes?: string): boolean {
    const loan = this.getLoanById(loanId);
    if (!loan) return false;

    loan.status = 'CLOSED';
    loan.closedDate = closureDate;
    loan.closureNotes = closureNotes || 'Loan closed manually';
    loan.outstandingPrincipal = 0;
    loan.emisRemaining = 0;
    loan.nextEmiDate = '';
    loan.nextEmiAmount = 0;

    const schedule = this.getSchedule(loanId);
    schedule.forEach((item) => {
      if (item.status === 'PENDING' || item.status === 'OVERDUE') {
        item.status = 'PAID';
      }
    });

    this.saveLoan(loan, schedule);
    return true;
  }

  public reopenLoan(loanId: string): boolean {
    const loan = this.getLoanById(loanId);
    if (!loan) return false;

    loan.status = 'ACTIVE';
    loan.closedDate = undefined;
    loan.closureNotes = undefined;

    const schedule = this.getSchedule(loanId);
    this.recalculateLoanMetricsFromSchedule(loan, schedule);
    this.saveLoan(loan, schedule);
    return true;
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
    let docs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    docs = docs.filter((d) => d.id !== docId);
    this.set(STORAGE_KEYS.DOCUMENTS, docs);
    this.pushToServer();
  }

  public getNotes(loanId: string): LoanNote[] {
    const allNotes = this.get<LoanNote[]>(STORAGE_KEYS.NOTES, []);
    return allNotes.filter((n) => n.loanId === loanId);
  }

  public addNote(loanId: string, text: string): void {
    const allNotes = this.get<LoanNote[]>(STORAGE_KEYS.NOTES, []);
    allNotes.unshift({
      id: 'note_' + Date.now(),
      loanId,
      text,
      createdAt: new Date().toISOString(),
    });
    this.set(STORAGE_KEYS.NOTES, allNotes);
    this.pushToServer();
  }

  public getAuditLogs(): AuditLog[] {
    return this.get<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
  }

  public logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const logs = this.get<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
    logs.unshift({
      ...entry,
      id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
    });
    this.set(STORAGE_KEYS.AUDIT, logs.slice(0, 500));
  }

  public getDeposits(includeClosed: boolean = true, forUserId?: string): Deposit[] {
    const currentUser = this.getCurrentUser();
    const targetUserId = forUserId || currentUser?.id;
    if (!targetUserId) return [];
    const allDeposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
    const userDeposits = allDeposits.filter((d) => {
      if (targetUserId === MASTER_USER.id) {
        return (d.userId || MASTER_USER.id) === MASTER_USER.id;
      }
      return d.userId === targetUserId;
    });
    return includeClosed ? userDeposits : userDeposits.filter((d) => d.status !== 'CLOSED');
  }

  public getDeposit(id: string): Deposit | null {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return null;
    const allDeposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
    return allDeposits.find((d) => d.id === id) || null;
  }

  public saveDeposit(deposit: Deposit, schedule?: DepositScheduleItem[]): void {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;
    deposit.userId = currentUser.id;
    const deposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
    const existingIndex = deposits.findIndex((d) => d.id === deposit.id);

    if (existingIndex >= 0) {
      deposits[existingIndex] = { ...deposit, updatedAt: new Date().toISOString() };
    } else {
      deposits.push({ ...deposit, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }

    this.set(STORAGE_KEYS.DEPOSITS, deposits);
    if (schedule && schedule.length > 0) {
      this.saveDepositSchedule(deposit.id, schedule);
    }
    this.pushToServer();
  }

  public updateDeposit(deposit: Deposit): void {
    this.saveDeposit(deposit);
  }

  public deleteDeposit(id: string): boolean {
    let deposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
    deposits = deposits.filter((d) => d.id !== id);
    this.set(STORAGE_KEYS.DEPOSITS, deposits);
    this.pushToServer();
    return true;
  }

  public getDepositSchedule(depositId: string): DepositScheduleItem[] {
    const allSchedules = this.get<Record<string, DepositScheduleItem[]>>(
      STORAGE_KEYS.DEPOSIT_SCHEDULES,
      {}
    );
    return allSchedules[depositId] || [];
  }

  public saveDepositSchedule(depositId: string, schedule: DepositScheduleItem[]): void {
    const allSchedules = this.get<Record<string, DepositScheduleItem[]>>(
      STORAGE_KEYS.DEPOSIT_SCHEDULES,
      {}
    );
    allSchedules[depositId] = schedule;
    this.set(STORAGE_KEYS.DEPOSIT_SCHEDULES, allSchedules);
    this.pushToServer();
  }

  public updateDepositScheduleItem(depositId: string, item: DepositScheduleItem): void {
    const schedule = this.getDepositSchedule(depositId);
    const index = schedule.findIndex((s) => s.id === item.id);
    if (index >= 0) schedule[index] = item;
    else schedule.push(item);
    this.saveDepositSchedule(depositId, schedule);
  }

  public getDepositTransactions(depositId?: string): DepositTransaction[] {
    const allTxs = this.get<DepositTransaction[]>(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, []);
    return depositId ? allTxs.filter((t) => t.depositId === depositId) : allTxs;
  }

  public saveDepositTransaction(transaction: DepositTransaction): void {
    const allTxs = this.get<DepositTransaction[]>(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, []);
    allTxs.push(transaction);
    this.set(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, allTxs);
    this.pushToServer();
  }

  public matureDeposit(depositId: string): boolean {
    const deposit = this.getDeposit(depositId);
    if (!deposit) return false;
    deposit.status = 'MATURED';
    this.updateDeposit(deposit);
    return true;
  }

  public closeDeposit(depositId: string): boolean {
    const deposit = this.getDeposit(depositId);
    if (!deposit) return false;
    deposit.status = 'CLOSED';
    this.updateDeposit(deposit);
    return true;
  }

  // Recalculator helper: Sets accurate nextEmiDate
  private recalculateLoanMetricsFromSchedule(loan: Loan, schedule: EMIScheduleItem[]): void {
    let totalPrincipalPaid = 0;
    let totalInterestPaid = 0;
    let emisPaidCount = 0;
    let nextEmi: EMIScheduleItem | null = null;
    let hasOverdue = false;
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const item of schedule) {
      if (item.status === 'PAID') {
        emisPaidCount++;
        totalPrincipalPaid += item.principalComponent;
        totalInterestPaid += item.interestComponent;
      } else if (item.status === 'PARTIAL') {
        const paid = item.paidAmount || 0;
        const interestPart = Math.min(paid, item.interestComponent);
        const principalPart = Math.max(0, paid - interestPart);
        totalInterestPaid += interestPart;
        totalPrincipalPaid += principalPart;
      } else {
        const diff = getDaysDifference(item.dueDate, todayStr);
        if (diff < 0) {
          item.status = 'OVERDUE';
          hasOverdue = true;
        } else {
          item.status = 'PENDING';
        }

        if (!nextEmi) {
          nextEmi = item;
        }
      }
    }

    loan.emisPaid = emisPaidCount;
    loan.emisRemaining = Math.max(0, schedule.length - emisPaidCount);
    loan.totalPrincipalPaid = Number(totalPrincipalPaid.toFixed(2));
    loan.totalInterestPaid = Number(totalInterestPaid.toFixed(2));
    loan.outstandingPrincipal = Math.max(
      0,
      Number((loan.originalAmount - totalPrincipalPaid).toFixed(2))
    );

    if (nextEmi) {
      loan.nextEmiDate = nextEmi.dueDate;
      loan.nextEmiAmount = nextEmi.emiAmount - (nextEmi.paidAmount || 0);
    } else {
      loan.nextEmiDate = '';
      loan.nextEmiAmount = 0;
    }

    if (loan.outstandingPrincipal <= 0) {
      loan.status = 'CLOSED';
    } else if (hasOverdue) {
      loan.status = 'OVERDUE';
    } else {
      loan.status = 'ACTIVE';
    }
  }

  public getOverdueSummary(): CentralizedOverdueResult {
    const loans = this.getLoans(false);
    return calculateCentralizedOverdue(loans, (id) => this.getSchedule(id), new Date().toISOString().slice(0, 10));
  }

  // ACCURATE DASHBOARD METRICS: Hamesha sabse paas wali Next Due EMI dhoondhega
  public getDashboardMetrics(): DashboardMetrics {
    const loans = this.getLoans(false);
    const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE');
    const closedLoans = loans.filter((l) => l.status === 'CLOSED' || l.status === 'FORECLOSED');

    const overdueSummary = this.getOverdueSummary();
    const overdueAmount = overdueSummary.overdueAmount;
    const overdueCount = overdueSummary.overdueCount;

    let totalOutstanding = 0;
    let totalMonthlyEmi = 0;
    let totalPrincipalBorrowed = 0;
    let totalPrincipalRepaid = 0;
    let totalInterestPaid = 0;
    let totalInterestRemaining = 0;
    let emisDueThisMonth = 0;

    let nearestNextEmi: DashboardMetrics['nextEmiDue'] = null;
    let earliestUpcomingDate: string | null = null;
    let latestClosureDate: string | null = null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentYearMonth = todayStr.substring(0, 7);

    // Sabhi active loans ke pending EMIs ko collect karein
    const allPendingEmis: Array<{
      loanId: string;
      loanName: string;
      lender: string;
      amount: number;
      dueDate: string;
      daysRemaining: number;
    }> = [];

    for (const loan of activeLoans) {
      totalOutstanding += loan.outstandingPrincipal;
      totalMonthlyEmi += loan.emiAmount;
      totalPrincipalBorrowed += loan.originalAmount;
      totalPrincipalRepaid += loan.totalPrincipalPaid;
      totalInterestPaid += loan.totalInterestPaid;
      totalInterestRemaining += Math.max(0, loan.totalInterest - loan.totalInterestPaid);

      if (loan.expectedClosureDate) {
        if (!latestClosureDate || loan.expectedClosureDate > latestClosureDate) {
          latestClosureDate = loan.expectedClosureDate;
        }
      }

      const schedule = this.getSchedule(loan.id);
      for (const item of schedule) {
        if (item.status === 'PAID') continue;

        const diff = getDaysDifference(item.dueDate, todayStr);
        const itemYearMonth = (item.dueDate || '').substring(0, 7);

        if (itemYearMonth === currentYearMonth) {
          emisDueThisMonth++;
        }

        const paid = Number(item.paidAmount) || 0;
        const dueAmt = Math.max(0, item.emiAmount - paid);

        allPendingEmis.push({
          loanId: loan.id,
          loanName: loan.name,
          lender: loan.lender,
          amount: dueAmt,
          dueDate: item.dueDate,
          daysRemaining: diff,
        });
      }
    }

    // Sort all pending EMIs by due date taaki sabse kareeb wali pehle aaye
    allPendingEmis.sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));

    // Sabse pehli future/today EMI dhoondhein
    const futureOrToday = allPendingEmis.find((e) => e.daysRemaining >= 0);
    if (futureOrToday) {
      nearestNextEmi = futureOrToday;
      earliestUpcomingDate = futureOrToday.dueDate;
    } else if (allPendingEmis.length > 0) {
      // Agar koi future nahi hai toh sabse latest overdue hi next candidate hai
      nearestNextEmi = allPendingEmis[0];
      earliestUpcomingDate = allPendingEmis[0].dueDate;
    }

    for (const loan of closedLoans) {
      totalPrincipalBorrowed += loan.originalAmount;
      totalPrincipalRepaid += loan.totalPrincipalPaid || loan.originalAmount;
      totalInterestPaid += loan.totalInterestPaid;
    }

    const overallProgress =
      totalPrincipalBorrowed > 0
        ? Math.min(100, Number(((totalPrincipalRepaid / totalPrincipalBorrowed) * 100).toFixed(1)))
        : 0;

    return {
      totalLoans: loans.length,
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      totalMonthlyEmi: Number(totalMonthlyEmi.toFixed(2)),
      nextEmiDue: nearestNextEmi,
      emisDueThisMonth,
      overdueAmount: Number(overdueAmount.toFixed(2)),
      overdueCount,
      activeLoansCount: activeLoans.length,
      closedLoansCount: closedLoans.length,
      totalPrincipalBorrowed: Number(totalPrincipalBorrowed.toFixed(2)),
      totalPrincipalRepaid: Number(totalPrincipalRepaid.toFixed(2)),
      totalInterestPaid: Number(totalInterestPaid.toFixed(2)),
      totalInterestRemaining: Number(totalInterestRemaining.toFixed(2)),
      overallRepaymentProgress: overallProgress,
      earliestUpcomingEmiDate: earliestUpcomingDate,
      latestClosureDate,
    };
  }

  public exportBackup(): string {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      loans: this.getLoans(true),
      schedules: this.get(STORAGE_KEYS.SCHEDULES, {}),
      documents: this.getDocuments(),
      notes: this.get(STORAGE_KEYS.NOTES, []),
      audit: this.getAuditLogs(),
      settings: this.getSettings(),
      deposits: this.getDeposits(true),
      depositSchedules: this.get(STORAGE_KEYS.DEPOSIT_SCHEDULES, {}),
      depositTransactions: this.get(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, []),
    };
    return JSON.stringify(backupData, null, 2);
  }

  public restoreBackup(jsonString: string): { success: boolean; error?: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data.loans || !Array.isArray(data.loans)) {
        return { success: false, error: 'Invalid backup file' };
      }

      this.set(STORAGE_KEYS.LOANS, data.loans);
      if (data.schedules) this.set(STORAGE_KEYS.SCHEDULES, data.schedules);
      if (data.documents) this.set(STORAGE_KEYS.DOCUMENTS, data.documents);
      if (data.notes) this.set(STORAGE_KEYS.NOTES, data.notes);
      if (data.audit) this.set(STORAGE_KEYS.AUDIT, data.audit);
      if (data.settings) this.set(STORAGE_KEYS.SETTINGS, data.settings);
      if (data.deposits) this.set(STORAGE_KEYS.DEPOSITS, data.deposits);
      if (data.depositSchedules) this.set(STORAGE_KEYS.DEPOSIT_SCHEDULES, data.depositSchedules);
      if (data.depositTransactions) this.set(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, data.depositTransactions);

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to parse JSON backup' };
    }
  }

  public loadDemoData(): void {
    // Demo data implementation
  }

  public clearDemoData(): void {
    // Clear demo data
  }

  public clearAllData(): void {
    const currentUserId = this.getCurrentUser()?.id;
    if (!currentUserId) return;
    this.set(STORAGE_KEYS.LOANS, []);
    this.set(STORAGE_KEYS.SCHEDULES, {});
    this.pushToServer();
  }
}

export const storageService = new StorageService();

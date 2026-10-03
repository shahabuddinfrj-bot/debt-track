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

// Current system reference date (2026-10-01 as provided in current local time)
export const CURRENT_DATE_STR = '2026-10-01';

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

  // Cloud/Server Synchronization for cross-tab and cross-iframe consistency
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
          // Push local loans to server so other devices can access them
          await this.pushToServer();
          return true;
        }

        if (data.loans.length > 0) {
          const serverHasRealLoans = data.loans.some((l: Loan) => !l.isDemo);
          const localHasRealLoans = localLoans.some((l: Loan) => !l.isDemo);

          let mergedLoans: Loan[] = [];

          if (localHasRealLoans && !serverHasRealLoans) {
            // Local device (e.g. computer where user created 13 loans) has real loans.
            // Server only has demo data. Prioritize real loans and push to server!
            mergedLoans = localLoans.filter((l: Loan) => !l.isDemo);
            this.set(STORAGE_KEYS.LOANS, mergedLoans);
            await this.pushToServer();
            return true;
          } else if (serverHasRealLoans) {
            // Server has authoritative real loans from user's primary device.
            // Remove demo placeholders on this device (e.g. mobile) and adopt real loans!
            const loanMap = new Map<string, Loan>();
            data.loans.filter((l: Loan) => !l.isDemo).forEach((l: Loan) => loanMap.set(l.id, l));
            localLoans.filter((l: Loan) => !l.isDemo).forEach((l: Loan) => {
              if (!loanMap.has(l.id)) loanMap.set(l.id, l);
            });
            mergedLoans = Array.from(loanMap.values());
            this.set(STORAGE_KEYS.LOANS, mergedLoans);
          } else {
            // Both only have demo data
            const loanMap = new Map<string, Loan>();
            localLoans.forEach((l: Loan) => loanMap.set(l.id, l));
            data.loans.forEach((l: Loan) => loanMap.set(l.id, l));
            mergedLoans = Array.from(loanMap.values());
            this.set(STORAGE_KEYS.LOANS, mergedLoans);
          }

          // Authoritative schedule merge: server schedules take precedence
          const localSchedules = this.get<Record<string, EMIScheduleItem[]>>(STORAGE_KEYS.SCHEDULES, {});
          const mergedSchedules = { ...localSchedules, ...(data.schedules || {}) };
          this.set(STORAGE_KEYS.SCHEDULES, mergedSchedules);

          // Merge docs
          if (data.documents && Array.isArray(data.documents)) {
            const localDocs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
            const docMap = new Map<string, LoanDocument>();
            localDocs.forEach((d: LoanDocument) => docMap.set(d.id, d));
            data.documents.forEach((d: LoanDocument) => docMap.set(d.id, d));
            this.set(STORAGE_KEYS.DOCUMENTS, Array.from(docMap.values()));
          }

          // Merge notes
          if (data.notes && Array.isArray(data.notes)) {
            const localNotes = this.get<LoanNote[]>(STORAGE_KEYS.NOTES, []);
            const noteMap = new Map<string, LoanNote>();
            localNotes.forEach((n: LoanNote) => noteMap.set(n.id, n));
            data.notes.forEach((n: LoanNote) => noteMap.set(n.id, n));
            this.set(STORAGE_KEYS.NOTES, Array.from(noteMap.values()));
          }

          // Merge deposits safely without altering loan data
          if (data.deposits && Array.isArray(data.deposits)) {
            const localDeposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
            const depositMap = new Map<string, Deposit>();
            data.deposits.forEach((d: Deposit) => depositMap.set(d.id, d));
            localDeposits.forEach((d: Deposit) => {
              if (!depositMap.has(d.id)) depositMap.set(d.id, d);
            });
            this.set(STORAGE_KEYS.DEPOSITS, Array.from(depositMap.values()));
          }

          // Merge deposit schedules
          if (data.depositSchedules && typeof data.depositSchedules === 'object') {
            const localDepSchedules = this.get<Record<string, DepositScheduleItem[]>>(STORAGE_KEYS.DEPOSIT_SCHEDULES, {});
            this.set(STORAGE_KEYS.DEPOSIT_SCHEDULES, { ...localDepSchedules, ...data.depositSchedules });
          }

          // Merge deposit transactions
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
      // Offline or network error
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

  // User Authentication & Session
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
        details: `Master Admin inspected user: ${user.name} (${user.email}) in Troubleshoot Mode`,
      });
    } else {
      this.logAudit({
        action: 'ADMIN_IMPERSONATION_ENDED',
        entity: 'SYSTEM',
        entityId: 'admin',
        details: 'Master Admin exited user Troubleshoot Mode',
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
    this.impersonatedUser = null; // Clear impersonation on actual login
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
        return { success: false, error: 'Incorrect password for Master Admin. Password is: admin123' };
      }
      this.setCurrentUser(user);
      return { success: true, user };
    }

    if (user.password && user.password !== password) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    this.setCurrentUser(user);
    return { success: true, user };
  }

  public logoutUser(): void {
    this.impersonatedUser = null;
    this.set(STORAGE_KEYS.CURRENT_USER, null);
  }

  // User Profile
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

  // Security & App Lock
  public getSecurityPin(): string {
    const settings = this.getSettings();
    return settings.securityPin || '';
  }

  public setSecurityPin(pin: string): void {
    const settings = this.getSettings();
    settings.securityPin = pin;
    settings.isAppLockEnabled = true;
    this.saveSettings(settings);
    this.logAudit({
      action: 'SETTINGS_UPDATED',
      entity: 'SETTINGS',
      entityId: 'security_pin',
      details: 'Updated 4-digit security PIN',
    });
  }

  public toggleAppLock(enabled: boolean): void {
    const settings = this.getSettings();
    settings.isAppLockEnabled = enabled;
    this.saveSettings(settings);
    this.logAudit({
      action: 'SETTINGS_UPDATED',
      entity: 'SETTINGS',
      entityId: 'app_lock',
      details: enabled ? 'Enabled App Lock protection' : 'Disabled App Lock protection',
    });
  }

  // Loans (Segregated by Current User)
  public getLoans(includeArchived: boolean = false, forUserId?: string): Loan[] {
    const currentUser = this.getCurrentUser();
    const targetUserId = forUserId || currentUser?.id;
    if (!targetUserId) {
      return []; // Unauthenticated guest visitors see NOTHING
    }
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
    const currentUserId = currentUser.id;
    loan.userId = currentUserId;
    const loans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const existingIndex = loans.findIndex((l) => l.id === loan.id);

    if (existingIndex >= 0) {
      loans[existingIndex] = { ...loan, updatedAt: new Date().toISOString() };
      this.logAudit({
        action: 'LOAN_UPDATED',
        entity: 'LOAN',
        entityId: loan.id,
        details: `Updated loan details for ${loan.name} (${loan.lender})`,
      });
    } else {
      loans.push(loan);
      this.logAudit({
        action: 'LOAN_CREATED',
        entity: 'LOAN',
        entityId: loan.id,
        details: `Created new ${loan.loanType}: ${loan.name} from ${loan.lender}`,
      });
    }

    this.set(STORAGE_KEYS.LOANS, loans);

    // Save schedule
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
    const currentUserId = currentUser.id;
    const loans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const loan = loans.find((l) => l.id === loanId);
    if (!loan || (loan.userId || MASTER_USER.id) !== currentUserId) return false;

    loan.isArchived = true;
    loan.updatedAt = new Date().toISOString();
    this.set(STORAGE_KEYS.LOANS, loans);
    this.pushToServer();

    this.logAudit({
      action: 'LOAN_ARCHIVED',
      entity: 'LOAN',
      entityId: loanId,
      details: `Archived loan ${loan.name}`,
    });
    return true;
  }

  public deleteLoanPermanently(loanId: string): boolean {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;
    const currentUserId = currentUser.id;
    let loans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const loan = loans.find((l) => l.id === loanId);
    if (!loan || (loan.userId || MASTER_USER.id) !== currentUserId) return false;

    loans = loans.filter((l) => l.id !== loanId);
    this.set(STORAGE_KEYS.LOANS, loans);

    // Clean up schedule
    const allSchedules = this.get<Record<string, EMIScheduleItem[]>>(
      STORAGE_KEYS.SCHEDULES,
      {}
    );
    delete allSchedules[loanId];
    this.set(STORAGE_KEYS.SCHEDULES, allSchedules);
    this.pushToServer();

    this.logAudit({
      action: 'LOAN_DELETED',
      entity: 'LOAN',
      entityId: loanId,
      details: `Permanently deleted loan ${loan.name}`,
    });
    return true;
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

    // Check if fully paid or partial
    if (totalPaidOnThisEmi >= emiItem.emiAmount - 0.5) {
      emiItem.status = 'PAID';
    } else {
      emiItem.status = 'PARTIAL';
    }

    // Recalculate loan totals from schedule
    this.recalculateLoanMetricsFromSchedule(loan, schedule);

    // Persist
    this.saveLoan(loan, schedule);

    this.logAudit({
      action: 'PAYMENT_RECORDED',
      entity: 'PAYMENT',
      entityId: paymentId,
      details: `Recorded payment of ₹${transaction.amountPaid} for ${loan.name} (EMI #${paymentNo}) via ${transaction.paymentMethod}`,
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

    const prepayId = 'prep_' + Date.now();
    const newSchedule = recalculateScheduleWithPrepayment(
      schedule,
      prepayment.date,
      prepayment.amount,
      prepayment.reductionOption,
      loan.interestRate,
      loan.interestType,
      loan.emiFrequency
    );

    // If foreclosure or balance is 0
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

    this.logAudit({
      action: 'PREPAYMENT_RECORDED',
      entity: 'PREPAYMENT',
      entityId: prepayId,
      details: `Prepayment of ₹${prepayment.amount} recorded on ${loan.name} (${prepayment.type} - ${prepayment.reductionOption})`,
    });

    return { success: true };
  }

  // Mark Loan as Closed manually
  public closeLoan(
    loanId: string,
    closureDate: string,
    closureNotes?: string
  ): boolean {
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
    // Mark remaining pending EMIs as closed/settled
    schedule.forEach((item) => {
      if (item.status === 'PENDING' || item.status === 'OVERDUE') {
        item.status = 'PAID';
        item.notes = (item.notes ? item.notes + ' ' : '') + '[Settled upon closure]';
      }
    });

    this.saveLoan(loan, schedule);

    this.logAudit({
      action: 'LOAN_CLOSED',
      entity: 'LOAN',
      entityId: loanId,
      details: `Loan ${loan.name} closed on ${closureDate}. ${closureNotes || ''}`,
    });

    return true;
  }

  // Re-open a closed loan if needed
  public reopenLoan(loanId: string): boolean {
    const loan = this.getLoanById(loanId);
    if (!loan) return false;

    loan.status = 'ACTIVE';
    loan.closedDate = undefined;
    loan.closureNotes = undefined;

    const schedule = this.getSchedule(loanId);
    this.recalculateLoanMetricsFromSchedule(loan, schedule);
    this.saveLoan(loan, schedule);

    this.logAudit({
      action: 'LOAN_REOPENED',
      entity: 'LOAN',
      entityId: loanId,
      details: `Loan ${loan.name} was reopened.`,
    });

    return true;
  }

  // Documents
  public getDocuments(loanId?: string): LoanDocument[] {
    const docs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    return loanId ? docs.filter((d) => d.loanId === loanId) : docs;
  }

  public saveDocument(doc: LoanDocument): void {
    const docs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    docs.push(doc);
    this.set(STORAGE_KEYS.DOCUMENTS, docs);
    this.pushToServer();

    this.logAudit({
      action: 'DOCUMENT_UPLOADED',
      entity: 'DOCUMENT',
      entityId: doc.id,
      details: `Attached document: ${doc.name} (${doc.type})`,
    });
  }

  public deleteDocument(docId: string): void {
    let docs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    docs = docs.filter((d) => d.id !== docId);
    this.set(STORAGE_KEYS.DOCUMENTS, docs);
    this.pushToServer();
  }

  // Notes
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

  // Audit Logs
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
    // Keep max 500 records
    this.set(STORAGE_KEYS.AUDIT, logs.slice(0, 500));
  }

  // ========================================================
  // DEPOSITS & RECURRING DEPOSITS (RD) PERSISTENCE
  // Completely isolated from Loans, EMIs, and Loan calculations
  // ========================================================

  public getDeposits(includeClosed: boolean = true, forUserId?: string): Deposit[] {
    const currentUser = this.getCurrentUser();
    const targetUserId = forUserId || currentUser?.id;
    if (!targetUserId) {
      return [];
    }
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
    const targetUserId = currentUser.id;
    const allDeposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
    const found = allDeposits.find((d) => d.id === id);
    if (!found) return null;
    if (targetUserId === MASTER_USER.id) {
      if (found.userId && found.userId !== MASTER_USER.id) return null;
    } else {
      if (found.userId !== targetUserId) return null;
    }
    return found;
  }

  public saveDeposit(deposit: Deposit, schedule?: DepositScheduleItem[]): void {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;
    deposit.userId = currentUser.id;
    const deposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
    const existingIndex = deposits.findIndex((d) => d.id === deposit.id);

    if (existingIndex >= 0) {
      deposits[existingIndex] = { ...deposit, updatedAt: new Date().toISOString() };
      this.logAudit({
        action: 'DEPOSIT_UPDATED',
        entity: 'SYSTEM',
        entityId: deposit.id,
        details: `Updated deposit details for ${deposit.name} (${deposit.type})`,
      });
    } else {
      deposits.push({
        ...deposit,
        createdAt: deposit.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.logAudit({
        action: 'DEPOSIT_CREATED',
        entity: 'SYSTEM',
        entityId: deposit.id,
        details: `Created new deposit: ${deposit.name} (${deposit.type})`,
      });
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
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;
    const currentUserId = currentUser.id;
    let deposits = this.get<Deposit[]>(STORAGE_KEYS.DEPOSITS, []);
    const deposit = deposits.find((d) => d.id === id);
    if (!deposit || (deposit.userId || MASTER_USER.id) !== currentUserId) return false;

    deposits = deposits.filter((d) => d.id !== id);
    this.set(STORAGE_KEYS.DEPOSITS, deposits);

    // Clean up schedule for this deposit only
    const allSchedules = this.get<Record<string, DepositScheduleItem[]>>(
      STORAGE_KEYS.DEPOSIT_SCHEDULES,
      {}
    );
    delete allSchedules[id];
    this.set(STORAGE_KEYS.DEPOSIT_SCHEDULES, allSchedules);

    // Clean up transactions for this deposit only
    let allTransactions = this.get<DepositTransaction[]>(
      STORAGE_KEYS.DEPOSIT_TRANSACTIONS,
      []
    );
    allTransactions = allTransactions.filter((tx) => tx.depositId !== id);
    this.set(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, allTransactions);

    this.pushToServer();

    this.logAudit({
      action: 'DEPOSIT_DELETED',
      entity: 'SYSTEM',
      entityId: id,
      details: `Deleted deposit ${deposit.name}`,
    });
    return true;
  }

  // Deposit Schedule Methods
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
    const index = schedule.findIndex((s) => s.id === item.id || s.installmentNumber === item.installmentNumber);
    if (index >= 0) {
      schedule[index] = item;
    } else {
      schedule.push(item);
    }
    this.saveDepositSchedule(depositId, schedule);
  }

  // Deposit Transaction Methods
  public getDepositTransactions(depositId?: string): DepositTransaction[] {
    const allTxs = this.get<DepositTransaction[]>(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, []);
    if (!depositId) return allTxs;
    return allTxs.filter((t) => t.depositId === depositId);
  }

  public saveDepositTransaction(transaction: DepositTransaction): void {
    const allTxs = this.get<DepositTransaction[]>(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, []);
    const existingIndex = allTxs.findIndex((t) => t.id === transaction.id);
    if (existingIndex >= 0) {
      allTxs[existingIndex] = transaction;
    } else {
      allTxs.push(transaction);
    }
    this.set(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, allTxs);

    // If transaction is linked to a schedule item, update schedule item status
    if (transaction.scheduleItemId && transaction.depositId) {
      const schedule = this.getDepositSchedule(transaction.depositId);
      const item = schedule.find((s) => s.id === transaction.scheduleItemId);
      if (item) {
        item.paidAmount = (item.paidAmount || 0) + transaction.amount;
        item.paidDate = transaction.transactionDate;
        item.transactionId = transaction.id;
        if (item.paidAmount >= item.expectedAmount) {
          item.status = 'PAID';
        } else if (item.paidAmount > 0) {
          item.status = 'PARTIAL';
        }
        this.saveDepositSchedule(transaction.depositId, schedule);
      }
    }

    // Update deposit's current balance and contributions paid
    const deposit = this.getDeposit(transaction.depositId);
    if (deposit) {
      if (transaction.transactionType === 'CONTRIBUTION') {
        deposit.totalContributionsPaid = (deposit.totalContributionsPaid || 0) + transaction.amount;
        deposit.currentBalance = (deposit.currentBalance || 0) + transaction.amount;
      } else if (transaction.transactionType === 'INTEREST') {
        deposit.totalInterestEarned = (deposit.totalInterestEarned || 0) + transaction.amount;
        deposit.currentBalance = (deposit.currentBalance || 0) + transaction.amount;
      } else if (transaction.transactionType === 'WITHDRAWAL') {
        deposit.currentBalance = Math.max(0, (deposit.currentBalance || 0) - transaction.amount);
      } else if (transaction.transactionType === 'ADJUSTMENT') {
        deposit.currentBalance = (deposit.currentBalance || 0) + transaction.amount;
      }
      deposit.updatedAt = new Date().toISOString();
      this.updateDeposit(deposit);
    }

    this.logAudit({
      action: 'DEPOSIT_CONTRIBUTION_RECORDED',
      entity: 'SYSTEM',
      entityId: transaction.depositId,
      details: `Recorded deposit ${transaction.transactionType}: ₹${transaction.amount} on ${transaction.transactionDate}`,
    });

    this.pushToServer();
  }

  // Deposit Lifecycle Methods
  public matureDeposit(depositId: string): boolean {
    const deposit = this.getDeposit(depositId);
    if (!deposit) return false;
    deposit.status = 'MATURED';
    deposit.updatedAt = new Date().toISOString();
    this.updateDeposit(deposit);
    this.logAudit({
      action: 'DEPOSIT_MATURED',
      entity: 'SYSTEM',
      entityId: depositId,
      details: `Deposit ${deposit.name} reached maturity.`,
    });
    return true;
  }

  public closeDeposit(depositId: string): boolean {
    const deposit = this.getDeposit(depositId);
    if (!deposit) return false;
    deposit.status = 'CLOSED';
    deposit.updatedAt = new Date().toISOString();
    this.updateDeposit(deposit);
    this.logAudit({
      action: 'DEPOSIT_CLOSED',
      entity: 'SYSTEM',
      entityId: depositId,
      details: `Deposit ${deposit.name} marked as closed.`,
    });
    return true;
  }

  // Recalculator helper for maintaining consistency
  private recalculateLoanMetricsFromSchedule(loan: Loan, schedule: EMIScheduleItem[]): void {
    let totalPrincipalPaid = 0;
    let totalInterestPaid = 0;
    let emisPaidCount = 0;
    let nextEmi: EMIScheduleItem | null = null;
    let hasOverdue = false;

    // Scan schedule
    for (const item of schedule) {
      if (item.status === 'PAID') {
        emisPaidCount++;
        totalPrincipalPaid += item.principalComponent;
        totalInterestPaid += item.interestComponent;
      } else if (item.status === 'PARTIAL') {
        // Apportion paid amount to interest then principal
        const paid = item.paidAmount || 0;
        const interestPart = Math.min(paid, item.interestComponent);
        const principalPart = Math.max(0, paid - interestPart);
        totalInterestPaid += interestPart;
        totalPrincipalPaid += principalPart;
      } else {
        // Pending
        // Check if overdue relative to CURRENT_DATE_STR
        const diff = getDaysDifference(item.dueDate, CURRENT_DATE_STR);
        if (diff < 0) {
          item.status = 'OVERDUE';
          hasOverdue = true;
        }

        if (!nextEmi) {
          nextEmi = item;
        }
      }

      if (item.status === 'OVERDUE') {
        hasOverdue = true;
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
    } else if (loan.status === 'OVERDUE') {
      loan.status = 'ACTIVE';
    }
  }

  // Centralized Overdue Summary (Used by Dashboard, Overdue Management View, and Navigation Banners)
  public getOverdueSummary(): CentralizedOverdueResult {
    const loans = this.getLoans(false);
    return calculateCentralizedOverdue(loans, (id) => this.getSchedule(id), CURRENT_DATE_STR);
  }

  // Dashboard Metrics aggregation
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

    const currentYearMonth = CURRENT_DATE_STR.substring(0, 7); // "2026-10"

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

        const diff = getDaysDifference(item.dueDate, CURRENT_DATE_STR);
        const itemYearMonth = (item.dueDate || '').substring(0, 7);

        if (itemYearMonth === currentYearMonth) {
          emisDueThisMonth++;
        }

        const paid = Number(item.paidAmount) || 0;

        // Check if next upcoming
        if (diff >= 0) {
          if (!earliestUpcomingDate || item.dueDate < earliestUpcomingDate) {
            earliestUpcomingDate = item.dueDate;
            nearestNextEmi = {
              loanId: loan.id,
              loanName: loan.name,
              lender: loan.lender,
              amount: Math.max(0, item.emiAmount - paid),
              dueDate: item.dueDate,
              daysRemaining: diff,
            };
          }
        }
      }
    }

    // Include closed loans in historical borrowed & repaid calculations
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

  // Backup and Restore
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
        return { success: false, error: 'Invalid backup file: missing loans list' };
      }

      this.set(STORAGE_KEYS.LOANS, data.loans);
      if (data.schedules) this.set(STORAGE_KEYS.SCHEDULES, data.schedules);
      if (data.documents) this.set(STORAGE_KEYS.DOCUMENTS, data.documents);
      if (data.notes) this.set(STORAGE_KEYS.NOTES, data.notes);
      if (data.audit) this.set(STORAGE_KEYS.AUDIT, data.audit);
      if (data.settings) this.set(STORAGE_KEYS.SETTINGS, data.settings);

      // Backward compatible restore for deposits
      if (data.deposits && Array.isArray(data.deposits)) {
        this.set(STORAGE_KEYS.DEPOSITS, data.deposits);
      }
      if (data.depositSchedules && typeof data.depositSchedules === 'object') {
        this.set(STORAGE_KEYS.DEPOSIT_SCHEDULES, data.depositSchedules);
      }
      if (data.depositTransactions && Array.isArray(data.depositTransactions)) {
        this.set(STORAGE_KEYS.DEPOSIT_TRANSACTIONS, data.depositTransactions);
      }

      this.logAudit({
        action: 'BACKUP_RESTORED',
        entity: 'SYSTEM',
        entityId: 'backup_restore',
        details: `Restored backup with ${data.loans.length} loans${data.deposits ? ` and ${data.deposits.length} deposits` : ''}`,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to parse JSON backup' };
    }
  }

  // Demo Data Generator
  public loadDemoData(): void {
    const currentUserId = this.getCurrentUser()?.id || MASTER_USER.id;
    // 5 diverse loans: Home Loan, Car Loan, Personal Loan, Gold Loan, Credit Card EMI
    const demoLoans: Loan[] = [
      {
        id: 'demo_loan_1',
        userId: currentUserId,
        name: 'Home Loan - Green Valley Apartment',
        lender: 'HDFC Bank',
        loanType: 'Home Loan',
        accountNumber: 'HL-88291044',
        originalAmount: 5000000,
        disbursedAmount: 5000000,
        outstandingPrincipal: 4625000,
        interestRate: 8.75,
        interestType: 'REDUCING_BALANCE',
        tenureMonths: 240,
        startDate: '2024-04-05',
        firstEmiDate: '2024-05-05',
        emiAmount: 44186,
        emiFrequency: 'MONTHLY',
        emiDueDay: 5,
        totalEmis: 240,
        emisPaid: 29,
        emisRemaining: 211,
        nextEmiDate: '2026-10-05',
        nextEmiAmount: 44186,
        expectedClosureDate: '2044-04-05',
        processingFee: 15000,
        otherCharges: 2500,
        totalInterest: 5604640,
        totalPayableAmount: 10604640,
        totalPrincipalPaid: 375000,
        totalInterestPaid: 906394,
        status: 'ACTIVE',
        notes: 'Sanctioned against Apartment #402. Floating interest rate.',
        calculationSource: 'SYSTEM_CALCULATED',
        isDemo: true,
        createdAt: '2024-04-05T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'demo_loan_2',
        userId: currentUserId,
        name: 'Electric SUV Car Loan',
        lender: 'ICICI Bank',
        loanType: 'Vehicle Loan',
        accountNumber: 'VL-41092301',
        originalAmount: 1200000,
        disbursedAmount: 1200000,
        outstandingPrincipal: 685400,
        interestRate: 8.9,
        interestType: 'REDUCING_BALANCE',
        tenureMonths: 60,
        startDate: '2024-01-10',
        firstEmiDate: '2024-02-10',
        emiAmount: 24867,
        emiFrequency: 'MONTHLY',
        emiDueDay: 10,
        totalEmis: 60,
        emisPaid: 32,
        emisRemaining: 28,
        nextEmiDate: '2026-10-10',
        nextEmiAmount: 24867,
        expectedClosureDate: '2029-01-10',
        processingFee: 4500,
        otherCharges: 500,
        totalInterest: 292020,
        totalPayableAmount: 1492020,
        totalPrincipalPaid: 514600,
        totalInterestPaid: 281144,
        status: 'ACTIVE',
        notes: 'Auto-debit setup on salary account.',
        calculationSource: 'SYSTEM_CALCULATED',
        isDemo: true,
        createdAt: '2024-01-10T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'demo_loan_3',
        userId: currentUserId,
        name: 'Home Renovation Personal Loan',
        lender: 'Bajaj Finserv',
        loanType: 'Personal Loan',
        accountNumber: 'PL-7738290',
        originalAmount: 400000,
        disbursedAmount: 392000,
        outstandingPrincipal: 172000,
        interestRate: 12.5,
        interestType: 'REDUCING_BALANCE',
        tenureMonths: 36,
        startDate: '2025-01-15',
        firstEmiDate: '2025-02-15',
        emiAmount: 13380,
        emiFrequency: 'MONTHLY',
        emiDueDay: 15,
        totalEmis: 36,
        emisPaid: 20,
        emisRemaining: 16,
        nextEmiDate: '2026-10-15',
        nextEmiAmount: 13380,
        expectedClosureDate: '2028-01-15',
        processingFee: 8000,
        otherCharges: 0,
        totalInterest: 81680,
        totalPayableAmount: 481680,
        totalPrincipalPaid: 228000,
        totalInterestPaid: 39600,
        status: 'ACTIVE',
        notes: 'Taken for kitchen and living room remodeling.',
        calculationSource: 'SYSTEM_CALCULATED',
        isDemo: true,
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'demo_loan_4',
        userId: currentUserId,
        name: 'Gold Loan - Sovereign Ornaments',
        lender: 'State Bank of India',
        loanType: 'Gold Loan',
        accountNumber: 'GL-10928374',
        originalAmount: 250000,
        disbursedAmount: 248500,
        outstandingPrincipal: 250000,
        interestRate: 9.0,
        interestType: 'INTEREST_ONLY',
        tenureMonths: 12,
        startDate: '2026-04-20',
        firstEmiDate: '2026-05-20',
        emiAmount: 1875,
        emiFrequency: 'MONTHLY',
        emiDueDay: 20,
        totalEmis: 12,
        emisPaid: 4,
        emisRemaining: 8,
        nextEmiDate: '2026-09-20', // OVERDUE by 11 days from 2026-10-01 to demonstrate overdue tracking!
        nextEmiAmount: 1875,
        expectedClosureDate: '2027-04-20',
        processingFee: 1500,
        otherCharges: 0,
        totalInterest: 22500,
        totalPayableAmount: 272500,
        totalPrincipalPaid: 0,
        totalInterestPaid: 7500,
        status: 'OVERDUE',
        notes: 'Pledged 48g gold ornaments. Bullet repayment of principal due April 2027.',
        calculationSource: 'SYSTEM_CALCULATED',
        isDemo: true,
        createdAt: '2026-04-20T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'demo_loan_5',
        userId: currentUserId,
        name: 'MacBook Pro 16-inch 0% EMI',
        lender: 'HDFC Bank Credit Card',
        loanType: 'Credit Card EMI',
        accountNumber: 'CC-EMI-9921',
        originalAmount: 199900,
        disbursedAmount: 199900,
        outstandingPrincipal: 0,
        interestRate: 0,
        interestType: 'FLAT_RATE',
        tenureMonths: 9,
        startDate: '2025-10-01',
        firstEmiDate: '2025-11-01',
        emiAmount: 22211,
        emiFrequency: 'MONTHLY',
        emiDueDay: 1,
        totalEmis: 9,
        emisPaid: 9,
        emisRemaining: 0,
        nextEmiDate: '',
        nextEmiAmount: 0,
        expectedClosureDate: '2026-07-01',
        processingFee: 199,
        otherCharges: 0,
        totalInterest: 0,
        totalPayableAmount: 199900,
        totalPrincipalPaid: 199900,
        totalInterestPaid: 0,
        status: 'CLOSED',
        closedDate: '2026-07-01',
        closureNotes: 'Successfully paid off in full on July 1, 2026. No Cost EMI.',
        calculationSource: 'USER_ENTERED',
        isDemo: true,
        createdAt: '2025-10-01T10:00:00Z',
        updatedAt: '2026-07-01T10:00:00Z',
      },
    ];

    // Generate schedules for demo loans
    const schedulesMap: Record<string, EMIScheduleItem[]> = {};

    demoLoans.forEach((loan) => {
      const schedule = generateAmortizationSchedule(
        loan.originalAmount,
        loan.interestRate,
        loan.tenureMonths,
        loan.startDate,
        loan.firstEmiDate,
        loan.interestType,
        loan.emiFrequency,
        loan.emiAmount
      );

      // Pre-fill paid payments
      for (let i = 0; i < schedule.length; i++) {
        const item = schedule[i];
        if (i < loan.emisPaid) {
          item.status = 'PAID';
          item.paidAmount = item.emiAmount;
          item.actualPaymentDate = item.dueDate;
          item.payments = [
            {
              id: `pay_demo_${loan.id}_${item.paymentNo}`,
              loanId: loan.id,
              emiPaymentNo: item.paymentNo,
              paymentDate: item.dueDate,
              amountPaid: item.emiAmount,
              principalComponent: item.principalComponent,
              interestComponent: item.interestComponent,
              paymentMethod: 'Auto Debit',
              transactionRef: `AUTODEBIT-${loan.lender.substring(0, 4).toUpperCase()}-${item.paymentNo}`,
              createdAt: `${item.dueDate}T09:30:00Z`,
            },
          ];
        } else {
          // Check if overdue
          const diff = getDaysDifference(item.dueDate, CURRENT_DATE_STR);
          if (diff < 0) {
            item.status = 'OVERDUE';
          } else {
            item.status = 'PENDING';
          }
        }
      }

      schedulesMap[loan.id] = schedule;
    });

    // Save demo loans & schedules (preserving other users' loans)
    const existingLoans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const otherUserLoans = existingLoans.filter(
      (l) => (l.userId || MASTER_USER.id) !== currentUserId
    );
    const updatedLoans = [...otherUserLoans, ...demoLoans];
    this.set(STORAGE_KEYS.LOANS, updatedLoans);

    const existingSchedules = this.get<Record<string, EMIScheduleItem[]>>(
      STORAGE_KEYS.SCHEDULES,
      {}
    );
    const mergedSchedules = { ...existingSchedules, ...schedulesMap };
    this.set(STORAGE_KEYS.SCHEDULES, mergedSchedules);

    // Add demo documents
    const demoDocs: LoanDocument[] = [
      {
        id: 'doc_demo_1',
        loanId: 'demo_loan_1',
        name: 'HDFC_Home_Loan_Sanction_Letter.pdf',
        type: 'Sanction Letter',
        uploadDate: '2024-04-05',
        fileSize: '1.4 MB',
        notes: 'Official sanction letter with ROI 8.75% linked to repo rate.',
      },
      {
        id: 'doc_demo_2',
        loanId: 'demo_loan_2',
        name: 'ICICI_Car_Loan_Agreement.pdf',
        type: 'Loan Agreement',
        uploadDate: '2024-01-10',
        fileSize: '890 KB',
        notes: 'Signed vehicle hypothecation agreement.',
      },
      {
        id: 'doc_demo_3',
        loanId: 'demo_loan_5',
        name: 'HDFC_NOC_Closure_Certificate.pdf',
        type: 'NOC',
        uploadDate: '2026-07-05',
        fileSize: '420 KB',
        notes: 'No Objection Certificate for MacBook EMI payoff.',
      },
    ];
    this.set(STORAGE_KEYS.DOCUMENTS, demoDocs);

    this.logAudit({
      action: 'DEMO_DATA_LOADED',
      entity: 'SYSTEM',
      entityId: 'demo_seed',
      details: 'Loaded 5 sample realistic loans (Home, Vehicle, Personal, Gold, Credit Card)',
    });

    this.pushToServer();
  }

  public clearDemoData(): void {
    const currentUserId = this.getCurrentUser()?.id;
    if (!currentUserId) return;
    let loans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const remainingLoans = loans.filter(
      (l) =>
        !(
          (l.userId || MASTER_USER.id) === currentUserId &&
          (l.isDemo || l.id.startsWith('demo_loan_'))
        )
    );
    this.set(STORAGE_KEYS.LOANS, remainingLoans);

    const schedules = this.get<Record<string, EMIScheduleItem[]>>(
      STORAGE_KEYS.SCHEDULES,
      {}
    );
    for (let i = 1; i <= 5; i++) {
      delete schedules[`demo_loan_${i}`];
      delete schedules[`demo_loan_${i}_${currentUserId}`];
    }
    this.set(STORAGE_KEYS.SCHEDULES, schedules);

    let docs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    docs = docs.filter((d) => !d.id.startsWith('doc_demo_') && !d.loanId.startsWith('demo_loan_'));
    this.set(STORAGE_KEYS.DOCUMENTS, docs);

    let notes = this.get<LoanNote[]>(STORAGE_KEYS.NOTES, []);
    notes = notes.filter((n) => !n.loanId.startsWith('demo_loan_'));
    this.set(STORAGE_KEYS.NOTES, notes);

    let audit = this.get<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
    audit = audit.filter((a) => !a.entityId.startsWith('demo_'));
    this.set(STORAGE_KEYS.AUDIT, audit);

    this.logAudit({
      action: 'DEMO_DATA_CLEARED',
      entity: 'SYSTEM',
      entityId: 'demo_clear',
      details: 'All demo loan accounts cleared. Ready for your original account details.',
    });

    this.pushToServer();
  }

  public clearAllData(): void {
    const currentUserId = this.getCurrentUser()?.id;
    if (!currentUserId) return;
    let loans = this.get<Loan[]>(STORAGE_KEYS.LOANS, []);
    const userLoanIds = new Set(
      loans.filter((l) => (l.userId || MASTER_USER.id) === currentUserId).map((l) => l.id)
    );
    const remainingLoans = loans.filter((l) => (l.userId || MASTER_USER.id) !== currentUserId);
    this.set(STORAGE_KEYS.LOANS, remainingLoans);

    const schedules = this.get<Record<string, EMIScheduleItem[]>>(
      STORAGE_KEYS.SCHEDULES,
      {}
    );
    userLoanIds.forEach((id) => delete schedules[id]);
    this.set(STORAGE_KEYS.SCHEDULES, schedules);

    let docs = this.get<LoanDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    docs = docs.filter((d) => !userLoanIds.has(d.loanId));
    this.set(STORAGE_KEYS.DOCUMENTS, docs);

    let notes = this.get<LoanNote[]>(STORAGE_KEYS.NOTES, []);
    notes = notes.filter((n) => !userLoanIds.has(n.loanId));
    this.set(STORAGE_KEYS.NOTES, notes);

    this.pushToServer();
  }
}

export const storageService = new StorageService();

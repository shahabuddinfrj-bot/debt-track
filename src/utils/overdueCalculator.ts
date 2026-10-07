import { EMIScheduleItem, Loan } from '../types/loan';
import { Deposit, DepositScheduleItem } from '../types/deposit';
import { CURRENT_DATE_STR, storageService } from '../services/storage';

export interface CentralizedOverdueItem {
  loanId: string;
  loanName: string;
  lender: string;
  accountNumber: string;
  loanType: string;
  paymentNo: number;
  dueDate: string;
  emiAmount: number;
  paidAmount: number;
  overdueAmount: number;
  daysOverdue: number;
  totalOutstanding: number;
  notes?: string;
  category?: 'LOAN_EMI' | 'DEPOSIT_CONTRIBUTION';
}

export interface CentralizedOverdueResult {
  overdueCount: number;
  overdueAmount: number;
  overdueList: CentralizedOverdueItem[];
}

/**
 * Normalizes any date string (DD/MM/YYYY, DD-MM-YYYY, or ISO YYYY-MM-DD) into standard YYYY-MM-DD
 */
function toStandardIsoDate(rawDate: string): string {
  if (!rawDate) return '';
  const clean = String(rawDate).trim().split('T')[0];
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean.substring(0, 10);
}

/**
 * Authoritative overdue calculation engine for both Loans and Deposits (RD).
 */
export function calculateCentralizedOverdue(
  loans: Loan[],
  getScheduleForLoan: (loanId: string) => EMIScheduleItem[],
  baseDate: string = CURRENT_DATE_STR
): CentralizedOverdueResult {
  const overdueList: CentralizedOverdueItem[] = [];
  let totalOverdueAmount = 0;

  const todayIso = new Date().toISOString().substring(0, 10);
  const baseDateClean = baseDate ? toStandardIsoDate(baseDate) : todayIso;

  // 1. Scan Loans
  const validLoans = (loans || []).filter((l) => !l.isArchived && l.status !== 'CLOSED');

  for (const loan of validLoans) {
    const schedule = getScheduleForLoan(loan.id) || [];

    for (const item of schedule) {
      if (item.status === 'PAID') continue;

      const dueDateIso = toStandardIsoDate(item.dueDate || '');
      if (!dueDateIso) continue;

      const isPastDue = dueDateIso < baseDateClean;
      const isExplicitOverdue = item.status === 'OVERDUE';

      if (isPastDue || isExplicitOverdue) {
        const emiAmount = Number(item.emiAmount) || 0;
        const paidAmount = Number(item.paidAmount) || 0;
        const remainingOwed = Math.max(0, emiAmount - paidAmount);

        if (remainingOwed <= 0) continue;

        let daysOverdue = 1;
        try {
          const dueTime = new Date(dueDateIso + 'T00:00:00Z').getTime();
          const baseTime = new Date(baseDateClean + 'T00:00:00Z').getTime();
          const diffDays = Math.round((baseTime - dueTime) / (1000 * 60 * 60 * 24));
          daysOverdue = Math.max(1, diffDays);
        } catch {
          daysOverdue = 1;
        }

        totalOverdueAmount += remainingOwed;

        overdueList.push({
          loanId: loan.id,
          loanName: loan.name,
          lender: loan.lender,
          accountNumber: loan.accountNumber || '',
          loanType: loan.loanType,
          paymentNo: item.paymentNo,
          dueDate: item.dueDate,
          emiAmount,
          paidAmount,
          overdueAmount: remainingOwed,
          daysOverdue,
          totalOutstanding: loan.outstandingPrincipal || 0,
          notes: item.notes,
          category: 'LOAN_EMI',
        });
      }
    }
  }

  // 2. Scan Deposits & Recurring Deposits (RD)
  try {
    if (typeof storageService !== 'undefined' && typeof storageService.getDeposits === 'function') {
      const deposits = storageService.getDeposits(false) || [];
      for (const dep of deposits) {
        if (dep.status === 'CLOSED' || dep.status === 'MATURED') continue;
        const depSchedule = storageService.getDepositSchedule(dep.id) || [];

        for (const item of depSchedule) {
          if (item.status === 'PAID') continue;

          const dueDateIso = toStandardIsoDate(item.dueDate || '');
          if (!dueDateIso) continue;

          const isPastDue = dueDateIso < baseDateClean;
          const isExplicitOverdue = (item as any).status === 'OVERDUE';

          if (isPastDue || isExplicitOverdue) {
            const expectedAmount = Number(item.expectedAmount) || 0;
            const paidAmount = Number(item.paidAmount) || 0;
            const remainingOwed = Math.max(0, expectedAmount - paidAmount);

            if (remainingOwed <= 0) continue;

            let daysOverdue = 1;
            try {
              const dueTime = new Date(dueDateIso + 'T00:00:00Z').getTime();
              const baseTime = new Date(baseDateClean + 'T00:00:00Z').getTime();
              const diffDays = Math.round((baseTime - dueTime) / (1000 * 60 * 60 * 24));
              daysOverdue = Math.max(1, diffDays);
            } catch {
              daysOverdue = 1;
            }

            totalOverdueAmount += remainingOwed;

            overdueList.push({
              loanId: dep.id,
              loanName: dep.name,
              lender: dep.institutionName || 'RD / Deposit',
              accountNumber: dep.accountNumber || '',
              loanType: dep.type || 'Recurring Deposit',
              paymentNo: item.installmentNumber,
              dueDate: item.dueDate,
              emiAmount: expectedAmount,
              paidAmount,
              overdueAmount: remainingOwed,
              daysOverdue,
              totalOutstanding: dep.targetAmount ? Math.max(0, dep.targetAmount - (dep.currentBalance || 0)) : 0,
              category: 'DEPOSIT_CONTRIBUTION',
            });
          }
        }
      }
    }
  } catch (err) {
    // Graceful fallback agar circular import ya load time issue ho
  }

  // Sort descending by highest days overdue
  overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    overdueCount: overdueList.length,
    overdueAmount: Number(totalOverdueAmount.toFixed(2)),
    overdueList,
  };
}

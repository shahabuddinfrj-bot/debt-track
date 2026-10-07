import { EMIScheduleItem, Loan } from '../types/loan';
import { CURRENT_DATE_STR } from '../services/storage';

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
  const clean = rawDate.trim().split('T')[0];
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
 * Single, authoritative overdue calculation engine.
 * Ensures 100% mathematical consistency across:
 * - Desktop Dashboard
 * - Mobile Dashboard
 * - Overdue Tracker Page
 * - Navigation alert badges & indicators
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

  // Scan all active/overdue or non-archived loans
  const validLoans = (loans || []).filter((l) => !l.isArchived && l.status !== 'CLOSED');

  for (const loan of validLoans) {
    const schedule = getScheduleForLoan(loan.id) || [];

    for (const item of schedule) {
      // If fully paid, it is not overdue
      if (item.status === 'PAID') continue;

      const dueDateIso = toStandardIsoDate(item.dueDate || '');
      if (!dueDateIso) continue;

      // Past due condition: due date strictly before base date, or marked as OVERDUE
      const isPastDue = dueDateIso < baseDateClean;
      const isExplicitOverdue = item.status === 'OVERDUE';

      if (isPastDue || isExplicitOverdue) {
        const emiAmount = Number(item.emiAmount) || 0;
        const paidAmount = Number(item.paidAmount) || 0;
        const remainingOwed = Math.max(0, emiAmount - paidAmount);

        if (remainingOwed <= 0) continue;

        // Calculate days overdue in a robust way
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
        });
      }
    }
  }

  // Sort descending by most days overdue (highest urgency first)
  overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return {
    overdueCount: overdueList.length,
    overdueAmount: Number(totalOverdueAmount.toFixed(2)),
    overdueList,
  };
}

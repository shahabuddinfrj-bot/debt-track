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

  // Standardized ISO date string comparison (YYYY-MM-DD)
  // This is completely immune to timezone parsing bugs across mobile and desktop
  const baseDateClean = (baseDate || CURRENT_DATE_STR).trim().substring(0, 10);

  // Scan all active/overdue or non-archived loans
  const validLoans = (loans || []).filter((l) => !l.isArchived);

  for (const loan of validLoans) {
    const schedule = getScheduleForLoan(loan.id) || [];

    for (const item of schedule) {
      // If fully paid, it is not overdue
      if (item.status === 'PAID') continue;

      const dueDateClean = (item.dueDate || '').trim().substring(0, 10);
      if (!dueDateClean) continue;

      // Past due condition: due date strictly before base date, or marked as OVERDUE
      const isPastDue = dueDateClean < baseDateClean;
      const isExplicitOverdue = item.status === 'OVERDUE';

      if (isPastDue || isExplicitOverdue) {
        const emiAmount = Number(item.emiAmount) || 0;
        const paidAmount = Number(item.paidAmount) || 0;
        const remainingOwed = Math.max(0, emiAmount - paidAmount);

        // Calculate days overdue in a robust, timezone-neutral way
        let daysOverdue = 1;
        try {
          const dueTime = new Date(dueDateClean + 'T00:00:00Z').getTime();
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

import { UserSettings } from '../types/loan';

/**
 * Format currency with user's symbol and locale formatting (INR grouping or standard).
 */
export function formatCurrency(
  amount: number,
  currencySymbol: string = '₹',
  currencyCode: string = 'INR'
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return `${currencySymbol}0`;
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let formattedNumber = '';

  if (currencyCode === 'INR' || currencySymbol === '₹') {
    // Indian Numbering System: 2,50,000.00
    const parts = absAmount.toFixed(2).split('.');
    let intPart = parts[0];
    const decPart = parts[1];

    if (intPart.length > 3) {
      const lastThree = intPart.substring(intPart.length - 3);
      const otherNumbers = intPart.substring(0, intPart.length - 3);
      intPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    }

    formattedNumber = decPart === '00' ? intPart : `${intPart}.${decPart}`;
  } else {
    // Standard international grouping
    formattedNumber = absAmount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  return `${isNegative ? '-' : ''}${currencySymbol}${formattedNumber}`;
}

/**
 * Format date string (YYYY-MM-DD) according to user preferences.
 */
export function formatDate(
  dateString: string | undefined | null,
  format: UserSettings['dateFormat'] = 'DD/MM/YYYY'
): string {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;

  const [year, month, day] = parts;
  if (!year || !month || !day) return dateString;

  if (format === 'MM/DD/YYYY') {
    return `${month}/${day}/${year}`;
  }
  if (format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  // Default DD/MM/YYYY
  return `${day}/${month}/${year}`;
}

/**
 * Format date into a human readable month/year, e.g. "Oct 2026".
 */
export function formatMonthYear(dateString: string): string {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length < 2) return dateString;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  return `${monthNames[monthIdx] || parts[1]} ${year}`;
}

/**
 * Calculate difference in days between target date (YYYY-MM-DD) and today's date.
 * Returns negative if past/overdue, 0 if today, positive if future.
 */
export function getDaysDifference(targetDateStr: string, baseDateStr: string = '2026-10-01'): number {
  if (!targetDateStr) return 0;
  
  const target = new Date(targetDateStr + 'T00:00:00');
  const base = new Date(baseDateStr + 'T00:00:00');
  
  const diffTime = target.getTime() - base.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns humanized relative status text, e.g. "Due today", "In 3 days", "Overdue by 5 days".
 */
export function getRelativeDueDateText(dueDateStr: string, todayStr: string = '2026-10-01'): {
  text: string;
  isOverdue: boolean;
  isToday: boolean;
  days: number;
} {
  const days = getDaysDifference(dueDateStr, todayStr);
  if (days === 0) {
    return { text: 'Due Today', isOverdue: false, isToday: true, days: 0 };
  } else if (days < 0) {
    const overdueDays = Math.abs(days);
    return {
      text: overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`,
      isOverdue: true,
      isToday: false,
      days,
    };
  } else {
    return {
      text: days === 1 ? 'Due tomorrow' : `Due in ${days} days`,
      isOverdue: false,
      isToday: false,
      days,
    };
  }
}

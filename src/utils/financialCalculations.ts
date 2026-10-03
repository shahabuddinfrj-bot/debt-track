import { EMIFrequency, EMIScheduleItem, InterestType } from '../types/loan';

/**
 * High-precision financial math for loan amortization & EMI calculation.
 */

export interface CalculationResult {
  emi: number;
  totalInterest: number;
  totalPayable: number;
  effectiveRate: number;
  numberOfEmis: number;
  schedule: EMIScheduleItem[];
}

/**
 * Calculate Monthly or Quarterly EMI for reducing balance, flat rate, or interest-only loan.
 */
export function calculateEMI(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
  interestType: InterestType = 'REDUCING_BALANCE',
  frequency: EMIFrequency = 'MONTHLY'
): { emi: number; totalInterest: number; totalPayable: number; numberOfEmis: number } {
  if (principal <= 0 || tenureMonths <= 0) {
    return { emi: 0, totalInterest: 0, totalPayable: 0, numberOfEmis: 0 };
  }

  const periodsPerYear = frequency === 'QUARTERLY' ? 4 : 12;
  const periodMonths = frequency === 'QUARTERLY' ? 3 : 1;
  const numberOfEmis = Math.max(1, Math.round(tenureMonths / periodMonths));

  if (annualRatePct <= 0) {
    const emi = principal / numberOfEmis;
    return {
      emi: Number(emi.toFixed(2)),
      totalInterest: 0,
      totalPayable: principal,
      numberOfEmis,
    };
  }

  if (interestType === 'FLAT_RATE') {
    const years = tenureMonths / 12;
    const totalInterest = principal * (annualRatePct / 100) * years;
    const totalPayable = principal + totalInterest;
    const emi = totalPayable / numberOfEmis;
    return {
      emi: Number(emi.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
      totalPayable: Number(totalPayable.toFixed(2)),
      numberOfEmis,
    };
  }

  if (interestType === 'INTEREST_ONLY') {
    const periodRate = annualRatePct / (periodsPerYear * 100);
    const periodicInterest = principal * periodRate;
    const totalInterest = periodicInterest * numberOfEmis;
    const totalPayable = principal + totalInterest;
    return {
      emi: Number(periodicInterest.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
      totalPayable: Number(totalPayable.toFixed(2)),
      numberOfEmis,
    };
  }

  // Standard Reducing Balance (French Amortization)
  const periodicRate = annualRatePct / (periodsPerYear * 100);
  const factor = Math.pow(1 + periodicRate, numberOfEmis);
  const emi = (principal * periodicRate * factor) / (factor - 1);
  const totalPayable = emi * numberOfEmis;
  const totalInterest = totalPayable - principal;

  return {
    emi: Number(emi.toFixed(2)),
    totalInterest: Number(Math.max(0, totalInterest).toFixed(2)),
    totalPayable: Number(totalPayable.toFixed(2)),
    numberOfEmis,
  };
}

/**
 * Generate complete amortization schedule with dates and principal/interest breakdown.
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRatePct: number,
  tenureMonths: number,
  startDateStr: string, // YYYY-MM-DD
  firstEmiDateStr: string, // YYYY-MM-DD
  interestType: InterestType = 'REDUCING_BALANCE',
  frequency: EMIFrequency = 'MONTHLY',
  customEmiAmount?: number
): EMIScheduleItem[] {
  const { emi: calculatedEmi, numberOfEmis } = calculateEMI(
    principal,
    annualRatePct,
    tenureMonths,
    interestType,
    frequency
  );

  const emiToUse = customEmiAmount && customEmiAmount > 0 ? customEmiAmount : calculatedEmi;
  const periodsPerYear = frequency === 'QUARTERLY' ? 4 : 12;
  const periodicRate = annualRatePct / (periodsPerYear * 100);
  const monthStep = frequency === 'QUARTERLY' ? 3 : 1;

  const firstEmiDate = new Date(firstEmiDateStr);
  const baseYear = firstEmiDate.getFullYear();
  const baseMonth = firstEmiDate.getMonth();
  const baseDay = firstEmiDate.getDate();

  const schedule: EMIScheduleItem[] = [];
  let currentPrincipal = principal;

  for (let i = 1; i <= numberOfEmis; i++) {
    // Calculate target date for payment #i
    // month delta = (i - 1) * monthStep
    const targetDate = new Date(baseYear, baseMonth + (i - 1) * monthStep, baseDay);
    // Format YYYY-MM-DD
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dueDate = `${yyyy}-${mm}-${dd}`;

    const openingPrincipal = Number(currentPrincipal.toFixed(2));
    let interestComponent = 0;
    let principalComponent = 0;
    let closingPrincipal = 0;
    let installmentEmi = emiToUse;

    if (interestType === 'FLAT_RATE') {
      const years = tenureMonths / 12;
      const totalFlatInterest = principal * (annualRatePct / 100) * years;
      interestComponent = Number((totalFlatInterest / numberOfEmis).toFixed(2));
      principalComponent = Number((principal / numberOfEmis).toFixed(2));
      closingPrincipal = Math.max(0, Number((openingPrincipal - principalComponent).toFixed(2)));
    } else if (interestType === 'INTEREST_ONLY') {
      interestComponent = Number((openingPrincipal * periodicRate).toFixed(2));
      if (i === numberOfEmis) {
        principalComponent = openingPrincipal;
        installmentEmi = principalComponent + interestComponent;
        closingPrincipal = 0;
      } else {
        principalComponent = 0;
        closingPrincipal = openingPrincipal;
      }
    } else {
      // Reducing balance
      interestComponent = Number((openingPrincipal * periodicRate).toFixed(2));
      principalComponent = Number((installmentEmi - interestComponent).toFixed(2));

      // Handle final installment balance edge cases
      if (i === numberOfEmis || principalComponent >= openingPrincipal) {
        principalComponent = openingPrincipal;
        installmentEmi = Number((principalComponent + interestComponent).toFixed(2));
        closingPrincipal = 0;
      } else {
        closingPrincipal = Math.max(0, Number((openingPrincipal - principalComponent).toFixed(2)));
      }
    }

    currentPrincipal = closingPrincipal;

    schedule.push({
      paymentNo: i,
      dueDate,
      openingPrincipal,
      emiAmount: installmentEmi,
      interestComponent,
      principalComponent,
      closingPrincipal,
      status: 'PENDING',
      paidAmount: 0,
      payments: [],
    });

    if (closingPrincipal <= 0) break;
  }

  return schedule;
}

/**
 * Recalculate schedule after a prepayment (Part payment towards principal or Foreclosure).
 */
export function recalculateScheduleWithPrepayment(
  existingSchedule: EMIScheduleItem[],
  prepaymentDate: string,
  prepaymentAmount: number,
  reductionOption: 'REDUCE_EMI' | 'REDUCE_TENURE',
  annualRatePct: number,
  interestType: InterestType,
  frequency: EMIFrequency = 'MONTHLY'
): EMIScheduleItem[] {
  // Split schedule into past (already paid/partial) and remaining (unpaid)
  const newSchedule: EMIScheduleItem[] = [];
  let foundPrepaymentPoint = false;
  let remainingPrincipal = 0;

  for (const item of existingSchedule) {
    if (item.dueDate <= prepaymentDate || item.status === 'PAID') {
      newSchedule.push({ ...item });
      remainingPrincipal = item.closingPrincipal;
    } else {
      foundPrepaymentPoint = true;
      break;
    }
  }

  // Deduct prepayment amount from remaining principal
  const adjustedPrincipal = Math.max(0, remainingPrincipal - prepaymentAmount);

  if (adjustedPrincipal <= 0) {
    // Loan is completely paid off / foreclosed
    return newSchedule;
  }

  const unservedItems = existingSchedule.filter(
    (item) => !newSchedule.some((n) => n.paymentNo === item.paymentNo)
  );

  if (unservedItems.length === 0) return newSchedule;

  const periodsPerYear = frequency === 'QUARTERLY' ? 4 : 12;
  const periodicRate = annualRatePct / (periodsPerYear * 100);

  if (reductionOption === 'REDUCE_EMI') {
    // Keep remaining tenure count the same, compute lower EMI
    const remainingPeriods = unservedItems.length;
    let newEmi = 0;

    if (interestType === 'REDUCING_BALANCE' && periodicRate > 0) {
      const factor = Math.pow(1 + periodicRate, remainingPeriods);
      newEmi = (adjustedPrincipal * periodicRate * factor) / (factor - 1);
    } else {
      newEmi = adjustedPrincipal / remainingPeriods;
    }
    newEmi = Number(newEmi.toFixed(2));

    let curP = adjustedPrincipal;
    for (let idx = 0; idx < unservedItems.length; idx++) {
      const original = unservedItems[idx];
      const opening = Number(curP.toFixed(2));
      const interest = Number((opening * periodicRate).toFixed(2));
      let principalComp = Number((newEmi - interest).toFixed(2));
      let installment = newEmi;

      if (idx === unservedItems.length - 1 || principalComp >= opening) {
        principalComp = opening;
        installment = Number((principalComp + interest).toFixed(2));
        curP = 0;
      } else {
        curP = Math.max(0, Number((opening - principalComp).toFixed(2)));
      }

      newSchedule.push({
        ...original,
        openingPrincipal: opening,
        emiAmount: installment,
        interestComponent: interest,
        principalComponent: principalComp,
        closingPrincipal: curP,
        status: 'PENDING',
        paidAmount: 0,
        payments: [],
      });
      if (curP <= 0) break;
    }
  } else {
    // REDUCE_TENURE: Keep original EMI, payoff faster in fewer installments
    const originalEmi = unservedItems[0].emiAmount;
    let curP = adjustedPrincipal;
    let idx = 0;

    while (curP > 0 && idx < unservedItems.length) {
      const original = unservedItems[idx];
      const opening = Number(curP.toFixed(2));
      const interest = Number((opening * periodicRate).toFixed(2));
      let principalComp = Number((originalEmi - interest).toFixed(2));
      let installment = originalEmi;

      if (principalComp >= opening) {
        principalComp = opening;
        installment = Number((principalComp + interest).toFixed(2));
        curP = 0;
      } else {
        curP = Math.max(0, Number((opening - principalComp).toFixed(2)));
      }

      newSchedule.push({
        ...original,
        openingPrincipal: opening,
        emiAmount: installment,
        interestComponent: interest,
        principalComponent: principalComp,
        closingPrincipal: curP,
        status: 'PENDING',
        paidAmount: 0,
        payments: [],
      });
      idx++;
    }
  }

  return newSchedule;
}

/**
 * Derive principal amount if user only enters EMI, interest rate, and tenure.
 */
export function calculatePrincipalFromEMI(
  emi: number,
  annualRatePct: number,
  tenureMonths: number,
  frequency: EMIFrequency = 'MONTHLY'
): number {
  if (emi <= 0 || tenureMonths <= 0) return 0;
  const periodsPerYear = frequency === 'QUARTERLY' ? 4 : 12;
  const numberOfEmis = frequency === 'QUARTERLY' ? Math.round(tenureMonths / 3) : tenureMonths;

  if (annualRatePct <= 0) {
    return Number((emi * numberOfEmis).toFixed(2));
  }

  const periodicRate = annualRatePct / (periodsPerYear * 100);
  const factor = Math.pow(1 + periodicRate, numberOfEmis);
  const principal = (emi * (factor - 1)) / (periodicRate * factor);
  return Number(principal.toFixed(2));
}

/**
 * Derive tenure in months if user enters Principal, Rate, and EMI.
 */
export function calculateTenureFromPrincipalEMI(
  principal: number,
  emi: number,
  annualRatePct: number,
  frequency: EMIFrequency = 'MONTHLY'
): number {
  if (principal <= 0 || emi <= 0) return 0;
  const periodsPerYear = frequency === 'QUARTERLY' ? 4 : 12;
  const periodicRate = annualRatePct / (periodsPerYear * 100);

  // EMI must be greater than monthly interest
  if (emi <= principal * periodicRate) {
    return 0; // Infinite tenure
  }

  // n = -ln(1 - (P * r) / EMI) / ln(1 + r)
  const numerator = -Math.log(1 - (principal * periodicRate) / emi);
  const denominator = Math.log(1 + periodicRate);
  const periods = numerator / denominator;
  const months = frequency === 'QUARTERLY' ? periods * 3 : periods;
  return Math.ceil(months);
}

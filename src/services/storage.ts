public getDashboardMetrics(): DashboardMetrics {
    const loans = this.getLoans(false);
    const activeLoans = loans.filter((l) => l.status !== 'CLOSED');
    const closedLoans = loans.filter((l) => l.status === 'CLOSED');

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

    const today = new Date().toISOString().slice(0, 10);
    const currentYearMonth = today.substring(0, 7);

    // Saari upcoming commitments (Loans) ko unified list se lene ka sabse surakshit tarika
    const unifiedList = this.getUnifiedUpcomingPayments();

    for (const loan of activeLoans) {
      totalOutstanding += loan.outstandingPrincipal;
      totalMonthlyEmi += loan.emiAmount;
      totalPrincipalBorrowed += loan.originalAmount;
      totalPrincipalRepaid += loan.totalPrincipalPaid;
      totalInterestPaid += loan.totalInterestPaid;
      totalInterestRemaining += Math.max(0, loan.totalInterest - loan.totalInterestPaid);
    }

    // Is mahine aane wali EMIs ki ginti
    for (const item of unifiedList) {
      const normDate = normalizeDateStr(item.dueDate);
      if (normDate.substring(0, 7) === currentYearMonth && item.category === 'LOAN_EMI') {
        emisDueThisMonth++;
      }
    }

    // Sabse pehli future ya today wali Loan EMI
    let nearestNextEmi: DashboardMetrics['nextEmiDue'] = null;
    const nextLoanEmi = unifiedList.find((item) => item.category === 'LOAN_EMI' && item.daysRemaining >= 0)
      || unifiedList.find((item) => item.category === 'LOAN_EMI');

    if (nextLoanEmi) {
      nearestNextEmi = {
        loanId: nextLoanEmi.sourceId,
        loanName: nextLoanEmi.name,
        lender: nextLoanEmi.entityName,
        amount: nextLoanEmi.amount,
        dueDate: nextLoanEmi.dueDate,
        daysRemaining: nextLoanEmi.daysRemaining,
      };
    }

    for (const loan of closedLoans) {
      totalPrincipalBorrowed += loan.originalAmount;
      totalPrincipalRepaid += loan.totalPrincipalPaid || loan.originalAmount;
      totalInterestPaid += loan.totalInterestPaid;
    }

    const overallProgress = totalPrincipalBorrowed > 0 
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
      earliestUpcomingEmiDate: nearestNextEmi ? nearestNextEmi.dueDate : null,
      latestClosureDate: null,
    };
  }
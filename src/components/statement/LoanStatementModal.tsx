import React from 'react';
import { X, Printer, Download, ShieldCheck } from 'lucide-react';
import { Loan, UserSettings } from '../../types/loan';
import { storageService, CURRENT_DATE_STR } from '../../services/storage';
import { formatCurrency, formatDate, formatMonthYear } from '../../utils/formatters';

interface LoanStatementModalProps {
  loanId: string | null;
  settings: UserSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const LoanStatementModal: React.FC<LoanStatementModalProps> = ({
  loanId,
  settings,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !loanId) return null;

  const loan = storageService.getLoanById(loanId);
  const schedule = storageService.getSchedule(loanId);

  if (!loan) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const userMeta = [
      `"Borrower Name","शाहबुद्दीन (Shahabuddin)"`,
      `"Mobile","9042233122"`,
      `"Email","shahabuddin.frj@gmail.com"`,
      `"Address","No. 72, 6th Cross, JJ Nagar, Moolakulam, Pondicherry - 605010"`,
      `"Loan Facility","${loan.name}"`,
      `"Lending Institution","${loan.lender}"`,
      `"Account Ref","${loan.accountNumber || 'LN-GENERAL'}"`,
      `"Statement Date","${formatDate(CURRENT_DATE_STR, settings.dateFormat)}"`,
      '',
    ];

    const headers = [
      'Installment No',
      'Due Date',
      'Opening Principal',
      'EMI Amount',
      'Interest',
      'Principal',
      'Closing Principal',
      'Status',
      'Paid Date',
      'Paid Amount',
    ];

    const rows = schedule.map((item) => [
      item.paymentNo,
      item.dueDate,
      item.openingPrincipal,
      item.emiAmount,
      item.interestComponent,
      item.principalComponent,
      item.closingPrincipal,
      item.status,
      item.actualPaymentDate || '',
      item.paidAmount || 0,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [...userMeta, headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${loan.name.replace(/\s+/g, '_')}_Statement.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl max-w-4xl w-full my-8 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Controls Bar (Not printed) */}
        <div className="no-print flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">Loan Account Statement</h3>
            <span className="text-xs text-slate-500 font-mono">({loan.lender})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Official Printable Statement Sheet */}
        <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-900 font-sans print:p-0 print:space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-4 gap-4">
            <div>
              <div className="text-xl font-black tracking-tight uppercase">
                Statement of Loan Account
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Generated from DebtTrack Personal Finance System
              </div>
            </div>
            <div className="text-left sm:text-right font-mono text-xs">
              <div className="font-bold">Date of Statement: {formatDate(CURRENT_DATE_STR, settings.dateFormat)}</div>
              <div className="text-slate-500">Account Ref: {loan.accountNumber || 'LN-GENERAL'}</div>
            </div>
          </div>

          {/* Borrower Profile Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 sm:p-4 text-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Borrower / Account Holder Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Name</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">शाहबुद्दीन (Shahabuddin)</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Mobile</span>
                <span className="font-semibold text-slate-900 font-mono block mt-0.5">9042233122</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Email</span>
                <span className="font-semibold text-slate-900 break-all block mt-0.5">shahabuddin.frj@gmail.com</span>
              </div>
              <div className="sm:col-span-2 md:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-medium block">Address</span>
                <span className="text-slate-800 leading-snug block mt-0.5">
                  No. 72, 6th Cross, JJ Nagar, Moolakulam, Pondicherry - 605010
                </span>
              </div>
            </div>
          </div>

          {/* Borrower & Facility Details */}
          <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                Loan Facility Information
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-sm">{loan.name}</div>
                <div>Lending Institution: {loan.lender}</div>
                <div>Product Type: {loan.loanType}</div>
                <div>Account/Ref: {loan.accountNumber || 'N/A'}</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                Sanction & Repayment Terms
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div>Original Sanction: {formatCurrency(loan.originalAmount, settings.currencySymbol, settings.currency)}</div>
                <div>Interest Rate: {loan.interestRate}% p.a. ({loan.interestType})</div>
                <div>Tenure: {loan.tenureMonths} Months ({loan.emiFrequency})</div>
                <div>Monthly Due Date: Day {loan.emiDueDay} of each month</div>
              </div>
            </div>
          </div>

          {/* Account Balances Summary Matrix */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Principal Repaid</div>
              <div className="text-base font-bold font-mono mt-1 text-emerald-800">
                {formatCurrency(loan.totalPrincipalPaid, settings.currencySymbol, settings.currency)}
              </div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Interest Paid</div>
              <div className="text-base font-bold font-mono mt-1 text-amber-800">
                {formatCurrency(loan.totalInterestPaid, settings.currencySymbol, settings.currency)}
              </div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Current Outstanding</div>
              <div className="text-base font-bold font-mono mt-1 text-slate-900">
                {formatCurrency(loan.outstandingPrincipal, settings.currencySymbol, settings.currency)}
              </div>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="text-[10px] uppercase font-semibold text-slate-500">Remaining EMIs</div>
              <div className="text-base font-bold font-mono mt-1 text-slate-900">
                {loan.emisRemaining} / {loan.totalEmis}
              </div>
            </div>
          </div>

          {/* Complete Repayment Ledger */}
          <div>
            <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">
              Full Repayment Ledger & Amortization Schedule
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-2 text-center">#</th>
                    <th className="py-2 px-2">Due Date</th>
                    <th className="py-2 px-2 text-right">Opening Balance</th>
                    <th className="py-2 px-2 text-right">EMI</th>
                    <th className="py-2 px-2 text-right">Interest</th>
                    <th className="py-2 px-2 text-right">Principal</th>
                    <th className="py-2 px-2 text-right">Closing Balance</th>
                    <th className="py-2 px-2 text-center">Status</th>
                    <th className="py-2 px-2 text-right">Paid Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedule.map((item) => (
                    <tr key={item.paymentNo} className={item.status === 'PAID' ? 'bg-emerald-50/20' : ''}>
                      <td className="py-1.5 px-2 text-center">{item.paymentNo}</td>
                      <td className="py-1.5 px-2">{formatDate(item.dueDate, settings.dateFormat)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {formatCurrency(item.openingPrincipal, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-semibold">
                        {formatCurrency(item.emiAmount, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {formatCurrency(item.interestComponent, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {formatCurrency(item.principalComponent, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {formatCurrency(item.closingPrincipal, settings.currencySymbol, settings.currency)}
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold">
                        <span className={item.status === 'PAID' ? 'text-emerald-700' : 'text-slate-500'}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        {item.actualPaymentDate ? formatDate(item.actualPaymentDate, settings.dateFormat) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statement Footer */}
          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
            <div>DebtTrack Personal Loan & EMI Management System</div>
            <div>Expected Loan Closure: {formatMonthYear(loan.expectedClosureDate)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

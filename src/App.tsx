import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { LoansListView } from './components/loans/LoansListView';
import { LoanDetailView } from './components/loans/LoanDetailView';
import { AddEditLoanModal } from './components/loans/AddEditLoanModal';
import { RecordPaymentModal } from './components/payments/RecordPaymentModal';
import { PrepaymentModal } from './components/payments/PrepaymentModal';
import { EMICalendarView } from './components/calendar/EMICalendarView';
import { UpcomingEMIsView } from './components/upcoming/UpcomingEMIsView';
import { OverdueManagementView } from './components/overdue/OverdueManagementView';
import { MonthlyFinancialView } from './components/monthly/MonthlyFinancialView';
import { ReportsAnalyticsView } from './components/reports/ReportsAnalyticsView';
import { AuditLogView } from './components/audit/AuditLogView';
import { BackupSettingsView } from './components/settings/BackupSettingsView';
import { LoanStatementModal } from './components/statement/LoanStatementModal';
import { LockScreen } from './components/security/LockScreen';
import { UserProfileView } from './components/profile/UserProfileView';
import { AuthModal } from './components/auth/AuthModal';
import { AdminPanelView } from './components/admin/AdminPanelView';
import { DepositsListView } from './components/deposits/DepositsListView';
import { DepositDetailView } from './components/deposits/DepositDetailView';
import { AddEditDepositModal } from './components/deposits/AddEditDepositModal';
import { RecordDepositPaymentModal } from './components/deposits/RecordDepositPaymentModal';
import { storageService, MASTER_USER } from './services/storage';
import { Loan, UserSettings, AuthUser } from './types/loan';
import { Deposit } from './types/deposit';

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);

  // Active Multi-User Session (Null by default for guest/unauthenticated visitors)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => storageService.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Master Admin Troubleshooting Mode State
  const [troubleshootUser, setTroubleshootUser] = useState<AuthUser | null>(() =>
    storageService.getImpersonatedUser()
  );

  // Settings
  const [settings, setSettings] = useState<UserSettings>(() => storageService.getSettings());

  // Security App Lock State
  const [isAppLocked, setIsAppLocked] = useState(() => {
    const currentPin = settings.securityPin || storageService.getSecurityPin();
    const isLockEnabled = settings.isAppLockEnabled;

    if (isLockEnabled && currentPin) {
      const isSessionUnlocked =
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('debttrack_session_unlocked') === 'true';
      return !isSessionUnlocked;
    }
    return false;
  });

  // Modal States
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentTargetLoanId, setPaymentTargetLoanId] = useState<string | null>(null);
  const [paymentTargetEmiNo, setPaymentTargetEmiNo] = useState<number | undefined>(undefined);

  const [isPrepaymentModalOpen, setIsPrepaymentModalOpen] = useState(false);
  const [prepaymentLoanId, setPrepaymentLoanId] = useState<string | null>(null);

  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementLoanId, setStatementLoanId] = useState<string | null>(null);

  // Deposit Modal States
  const [isAddDepositOpen, setIsAddDepositOpen] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null);
  const [isDepositPaymentModalOpen, setIsDepositPaymentModalOpen] = useState(false);
  const [depositPaymentTargetId, setDepositPaymentTargetId] = useState<string | null>(null);
  const [depositPaymentTargetInstNo, setDepositPaymentTargetInstNo] = useState<number | undefined>(undefined);

  // Cross-tab and Studio-to-web real-time backend synchronization
  useEffect(() => {
    storageService.pullFromServer().then(() => {
      triggerRefresh();
    });

    const handleFocus = () => {
      storageService.pullFromServer().then((hasUpdate) => {
        if (hasUpdate) triggerRefresh();
      });
    };
    window.addEventListener('focus', handleFocus);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        storageService.pullFromServer().then((hasUpdate) => {
          if (hasUpdate) triggerRefresh();
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('debttrack_')) {
        triggerRefresh();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    const timer = setInterval(() => {
      storageService.pullFromServer().then((hasUpdate) => {
        if (hasUpdate) triggerRefresh();
      });
    }, 2500);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(timer);
    };
  }, []);

  // Sync dark mode class
  useEffect(() => {
    if (settings.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.isDarkMode]);

  // Re-lock when app goes to background if autoLockOnBackground is enabled
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'hidden' &&
        settings.isAppLockEnabled &&
        settings.autoLockOnBackground
      ) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('debttrack_session_unlocked');
        }
        setIsAppLocked(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [settings.isAppLockEnabled, settings.autoLockOnBackground]);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleNavigate = (view: string) => {
    setActiveView(view);
    if (view !== 'loan-detail') {
      setSelectedLoanId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectLoan = (loanId: string) => {
    setSelectedLoanId(loanId);
    setActiveView('loan-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInspectUser = (user: AuthUser) => {
    storageService.setImpersonatedUser(user);
    setTroubleshootUser(user);
    setActiveView('dashboard');
    triggerRefresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExitTroubleshoot = () => {
    storageService.setImpersonatedUser(null);
    setTroubleshootUser(null);
    setActiveView('admin');
    triggerRefresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAddLoan = () => {
    if (troubleshootUser) {
      alert(`Troubleshoot Mode (Read-Only): Cannot create new loans while inspecting ${troubleshootUser.name}'s account.`);
      return;
    }
    setEditingLoan(null);
    setIsAddLoanOpen(true);
  };

  const handleOpenEditLoan = (loan: Loan) => {
    if (troubleshootUser) {
      alert(`Troubleshoot Mode (Read-Only): Cannot modify loans while inspecting ${troubleshootUser.name}'s account.`);
      return;
    }
    setEditingLoan(loan);
    setIsAddLoanOpen(true);
  };

  const handleQuickPay = (loanId: string, emiPaymentNo?: number) => {
    if (troubleshootUser) {
      alert(`Troubleshoot Mode (Read-Only): Cannot record payments while inspecting ${troubleshootUser.name}'s account.`);
      return;
    }
    setPaymentTargetLoanId(loanId);
    setPaymentTargetEmiNo(emiPaymentNo);
    setIsPaymentModalOpen(true);
  };

  const handleOpenPrepayment = (loanId: string) => {
    if (troubleshootUser) {
      alert(`Troubleshoot Mode (Read-Only): Cannot record prepayments while inspecting ${troubleshootUser.name}'s account.`);
      return;
    }
    setPrepaymentLoanId(loanId);
    setIsPrepaymentModalOpen(true);
  };

  const handleOpenStatement = (loanId: string) => {
    setStatementLoanId(loanId);
    setIsStatementModalOpen(true);
  };

  const handleLoadDemoData = () => {
    storageService.loadDemoData();
    triggerRefresh();
  };

  const handleClearDemoData = () => {
    storageService.clearDemoData();
    if (activeView === 'loan-detail') {
      setActiveView('loans');
    }
    triggerRefresh();
  };

  const handleSelectDeposit = (depositId: string) => {
    setSelectedDepositId(depositId);
    setActiveView('deposit-detail');
  };

  const handleOpenAddDeposit = () => {
    setEditingDeposit(null);
    setIsAddDepositOpen(true);
  };

  const handleOpenEditDeposit = (deposit: Deposit) => {
    setEditingDeposit(deposit);
    setIsAddDepositOpen(true);
  };

  const handleRecordDepositContribution = (depositId: string, installmentNo?: number) => {
    setDepositPaymentTargetId(depositId);
    setDepositPaymentTargetInstNo(installmentNo);
    setIsDepositPaymentModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-slate-200 dark:selection:bg-slate-800">
      {/* Persistent Troubleshoot Mode Top Alert Banner */}
      {troubleshootUser && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-3 shadow-md z-50 sticky top-0 border-b border-amber-600 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-950"></span>
            </span>
            <span>
              Viewing as <strong>{troubleshootUser.name}</strong> ({troubleshootUser.email}) (Troubleshoot Mode)
            </span>
          </div>
          <button
            onClick={handleExitTroubleshoot}
            className="px-3 py-1 bg-slate-950 text-white rounded-lg hover:bg-slate-900 transition-colors text-xs font-bold shrink-0 shadow-xs active:scale-95"
          >
            Exit to Master Admin
          </button>
        </div>
      )}

      {/* Top Bar Navigation */}
      <Navbar
        settings={settings}
        onUpdateSettings={(newSettings) => {
          setSettings(newSettings);
          storageService.saveSettings(newSettings);
        }}
        onOpenAddLoan={handleOpenAddLoan}
        onNavigate={handleNavigate}
        activeView={activeView}
        refreshTrigger={refreshTrigger}
        onRefreshAll={triggerRefresh}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          refreshTrigger={refreshTrigger}
        />

        {/* Dynamic Viewport Content */}
        <main className="flex-1 p-4 md:p-8 pb-24 lg:pb-12 overflow-y-auto">
          {activeView === 'dashboard' && (
            <DashboardView
              key={`dashboard_${refreshTrigger}`}
              settings={settings}
              onNavigate={handleNavigate}
              onOpenAddLoan={handleOpenAddLoan}
              onSelectLoan={handleSelectLoan}
              onQuickPay={handleQuickPay}
              onLoadDemoData={handleLoadDemoData}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeView === 'loans' && (
            <LoansListView
              key={`loans_${refreshTrigger}`}
              settings={settings}
              onOpenAddLoan={handleOpenAddLoan}
              onSelectLoan={handleSelectLoan}
              onQuickPay={handleQuickPay}
            />
          )}

          {activeView === 'loan-detail' && selectedLoanId && (
            <LoanDetailView
              loanId={selectedLoanId}
              settings={settings}
              onBack={() => setActiveView('loans')}
              onEditLoan={handleOpenEditLoan}
              onRecordPayment={handleQuickPay}
              onPrepayment={handleOpenPrepayment}
              onOpenStatement={handleOpenStatement}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeView === 'deposits' && (
            <DepositsListView
              key={`deposits_${refreshTrigger}`}
              settings={settings}
              onOpenAddDeposit={handleOpenAddDeposit}
              onSelectDeposit={handleSelectDeposit}
              onEditDeposit={handleOpenEditDeposit}
              onRecordContribution={handleRecordDepositContribution}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeView === 'deposit-detail' && selectedDepositId && (
            <DepositDetailView
              key={`deposit_detail_${selectedDepositId}_${refreshTrigger}`}
              depositId={selectedDepositId}
              settings={settings}
              onBack={() => setActiveView('deposits')}
              onEditDeposit={handleOpenEditDeposit}
              onRecordContribution={handleRecordDepositContribution}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeView === 'upcoming' && (
            <UpcomingEMIsView
              key={`upcoming_${refreshTrigger}`}
              settings={settings}
              onQuickPay={handleQuickPay}
              onSelectLoan={handleSelectLoan}
              onSelectDeposit={handleSelectDeposit}
            />
          )}

          {activeView === 'calendar' && (
            <EMICalendarView
              key={`calendar_${refreshTrigger}`}
              settings={settings}
              onQuickPay={handleQuickPay}
              onSelectLoan={handleSelectLoan}
            />
          )}

          {activeView === 'overdue' && (
            <OverdueManagementView
              key={`overdue_${refreshTrigger}`}
              settings={settings}
              onQuickPay={handleQuickPay}
              onSelectLoan={handleSelectLoan}
            />
          )}

          {activeView === 'monthly' && (
            <MonthlyFinancialView settings={settings} />
          )}

          {activeView === 'reports' && (
            <ReportsAnalyticsView settings={settings} />
          )}

          {activeView === 'audit' && (
            <AuditLogView />
          )}

          {activeView === 'profile' && (
            <UserProfileView
              settings={settings}
              onUpdateSettings={(newSettings) => {
                setSettings(newSettings);
                storageService.saveSettings(newSettings);
              }}
              onNavigate={handleNavigate}
              onLockApp={() => {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.removeItem('debttrack_session_unlocked');
                }
                setIsAppLocked(true);
              }}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {activeView === 'admin' && storageService.isMasterAdmin() && (
            <AdminPanelView
              onInspectUser={handleInspectUser}
              onNavigate={handleNavigate}
            />
          )}

          {activeView === 'settings' && (
            <BackupSettingsView
              settings={settings}
              onUpdateSettings={(newSettings) => {
                setSettings(newSettings);
                storageService.saveSettings(newSettings);
              }}
              onLoadDemoData={handleLoadDemoData}
              onClearDemoData={handleClearDemoData}
              onRefreshAll={triggerRefresh}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>

      {/* Add / Edit Loan Modal */}
      <AddEditLoanModal
        initialLoan={editingLoan}
        settings={settings}
        isOpen={isAddLoanOpen}
        onClose={() => {
          setIsAddLoanOpen(false);
          setEditingLoan(null);
        }}
        onSuccess={(loanId) => {
          triggerRefresh();
          handleSelectLoan(loanId);
        }}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        loanId={paymentTargetLoanId}
        targetPaymentNo={paymentTargetEmiNo}
        settings={settings}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentTargetLoanId(null);
          setPaymentTargetEmiNo(undefined);
        }}
        onSuccess={() => {
          triggerRefresh();
        }}
      />

      {/* Prepayment & Foreclosure Modal */}
      {prepaymentLoanId && (
        <PrepaymentModal
          loanId={prepaymentLoanId}
          settings={settings}
          isOpen={isPrepaymentModalOpen}
          onClose={() => {
            setIsPrepaymentModalOpen(false);
            setPrepaymentLoanId(null);
          }}
          onSuccess={() => {
            triggerRefresh();
          }}
        />
      )}

      {/* Loan Account Statement Modal */}
      <LoanStatementModal
        loanId={statementLoanId}
        settings={settings}
        isOpen={isStatementModalOpen}
        onClose={() => {
          setIsStatementModalOpen(false);
          setStatementLoanId(null);
        }}
      />

      {/* Deposit Modals */}
      <AddEditDepositModal
        initialDeposit={editingDeposit}
        settings={settings}
        isOpen={isAddDepositOpen}
        onClose={() => {
          setIsAddDepositOpen(false);
          setEditingDeposit(null);
        }}
        onSuccess={(depositId) => {
          triggerRefresh();
          setSelectedDepositId(depositId);
          setActiveView('deposit-detail');
        }}
      />

      <RecordDepositPaymentModal
        depositId={depositPaymentTargetId}
        targetInstallmentNumber={depositPaymentTargetInstNo}
        settings={settings}
        isOpen={isDepositPaymentModalOpen}
        onClose={() => {
          setIsDepositPaymentModalOpen(false);
          setDepositPaymentTargetId(null);
          setDepositPaymentTargetInstNo(undefined);
        }}
        onSuccess={() => {
          triggerRefresh();
        }}
      />

      {/* Multi-User Authentication Modal */}
      <AuthModal
        isOpen={!currentUser || isAuthModalOpen}
        onClose={() => {
          if (currentUser) {
            setIsAuthModalOpen(false);
          }
        }}
        currentUser={currentUser}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
          triggerRefresh();
        }}
      />

      {/* App Lock & Security Screen Overlay */}
      {isAppLocked && (
        <LockScreen
          settings={settings}
          onUnlock={() => setIsAppLocked(false)}
          onUpdateSettings={(newSettings) => {
            setSettings(newSettings);
            storageService.saveSettings(newSettings);
          }}
        />
      )}
    </div>
  );
}

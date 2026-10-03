import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Delete, ArrowRight, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { storageService } from '../../services/storage';
import { UserSettings } from '../../types/loan';

interface LockScreenProps {
  settings: UserSettings;
  onUnlock: () => void;
  onUpdateSettings: (newSettings: UserSettings) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  settings,
  onUnlock,
  onUpdateSettings,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  
  // Setup mode states (if user hasn't set a PIN yet)
  const existingPin = settings.securityPin || storageService.getSecurityPin();
  const isSetupMode = !existingPin;
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [tempCreatedPin, setTempCreatedPin] = useState('');

  // Handle number click
  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        handleCompletePin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg('');
    }
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const triggerShake = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      setPin('');
    }, 600);
  };

  const handleCompletePin = (enteredPin: string) => {
    if (isSetupMode) {
      if (setupStep === 'create') {
        setTempCreatedPin(enteredPin);
        setSetupStep('confirm');
        setPin('');
      } else {
        // Confirm step
        if (enteredPin === tempCreatedPin) {
          storageService.setSecurityPin(enteredPin);
          const updated = {
            ...settings,
            securityPin: enteredPin,
            isAppLockEnabled: true,
          };
          onUpdateSettings(updated);
          sessionStorage.setItem('debttrack_session_unlocked', 'true');
          onUnlock();
        } else {
          triggerShake('PINs did not match. Please try again.');
          setSetupStep('create');
          setTempCreatedPin('');
        }
      }
    } else {
      // Normal Unlock
      if (enteredPin === existingPin) {
        sessionStorage.setItem('debttrack_session_unlocked', 'true');
        onUnlock();
      } else {
        triggerShake('Incorrect PIN. Please try again.');
      }
    }
  };

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, setupStep, tempCreatedPin, existingPin]);

  const handleSkipSetup = () => {
    const updated = {
      ...settings,
      isAppLockEnabled: false,
    };
    onUpdateSettings(updated);
    storageService.toggleAppLock(false);
    sessionStorage.setItem('debttrack_session_unlocked', 'true');
    onUnlock();
  };

  const handleResetPin = () => {
    if (window.confirm('Reset security PIN? You will be prompted to create a new 4-digit PIN.')) {
      storageService.setSecurityPin('');
      storageService.toggleAppLock(false);
      const updated = {
        ...settings,
        securityPin: '',
        isAppLockEnabled: false,
      };
      onUpdateSettings(updated);
      setPin('');
      setSetupStep('create');
      setTempCreatedPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl selection:bg-none select-none">
      <div
        className={`w-full max-w-sm flex flex-col items-center justify-center transition-all ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {/* Top App Lock Badge */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-700/60 shadow-xl flex items-center justify-center text-slate-100 mb-4">
          {isSetupMode ? (
            <KeyRound className="w-8 h-8 text-amber-400" />
          ) : (
            <Lock className="w-8 h-8 text-emerald-400" />
          )}
        </div>

        {/* Title & Instructions */}
        <h1 className="text-xl font-bold tracking-tight text-white text-center">
          {isSetupMode
            ? setupStep === 'create'
              ? 'Set 4-Digit Security PIN'
              : 'Confirm Your Security PIN'
            : 'DebtTrack Protected'}
        </h1>
        <p className="text-xs text-slate-400 mt-1 mb-6 text-center max-w-xs">
          {isSetupMode
            ? setupStep === 'create'
              ? 'Create a 4-digit PIN to secure your loan and repayment data'
              : 'Re-enter your 4-digit PIN to confirm and activate App Lock'
            : 'Enter your 4-digit PIN to unlock your personal loan records'}
        </p>

        {/* Masked PIN Indicators (4 Dots) */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-250 ${
                  isFilled
                    ? 'bg-white scale-125 shadow-[0_0_12px_rgba(255,255,255,0.7)]'
                    : 'border-2 border-slate-700 bg-slate-900/60'
                } ${errorMsg ? 'border-rose-500 bg-rose-500' : ''}`}
              />
            );
          })}
        </div>

        {/* Error Feedback Message */}
        <div className="h-6 mb-3 flex items-center justify-center">
          {errorMsg ? (
            <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </p>
          ) : isSetupMode && setupStep === 'confirm' ? (
            <p className="text-[11px] text-amber-300 font-mono">Step 2 of 2: Confirm PIN</p>
          ) : null}
        </div>

        {/* Keypad Container (0-9, Clear, Backspace) */}
        <div className="grid grid-cols-3 gap-3.5 w-full max-w-[270px] mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-slate-900/90 border border-slate-800 text-white font-semibold text-xl hover:bg-slate-800 active:scale-95 active:bg-slate-700/80 transition-all shadow-sm focus:outline-none"
            >
              {digit}
            </button>
          ))}

          {/* Clear Key */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-slate-400 text-xs font-medium hover:text-white hover:bg-slate-800 active:scale-95 transition-all focus:outline-none"
          >
            Clear
          </button>

          {/* Zero Key */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-slate-900/90 border border-slate-800 text-white font-semibold text-xl hover:bg-slate-800 active:scale-95 active:bg-slate-700/80 transition-all shadow-sm focus:outline-none"
          >
            0
          </button>

          {/* Backspace Key */}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 flex items-center justify-center transition-all focus:outline-none"
            aria-label="Backspace"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Options / Recovery */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {isSetupMode ? (
            <button
              onClick={handleSkipSetup}
              className="hover:text-slate-200 transition-colors underline underline-offset-4"
            >
              Skip & Setup Later
            </button>
          ) : (
            <button
              onClick={handleResetPin}
              className="hover:text-slate-200 transition-colors text-[11px]"
            >
              Forgot PIN? Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

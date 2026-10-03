import React, { useState } from 'react';
import { X, Lock, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { storageService } from '../../services/storage';
import { UserSettings } from '../../types/loan';

interface ChangePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
}

export const ChangePinModal: React.FC<ChangePinModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const currentSavedPin = settings.securityPin || storageService.getSecurityPin();
  const hasExistingPin = !!currentSavedPin;

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (hasExistingPin && currentPin !== currentSavedPin) {
      setError('Current PIN is incorrect');
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      setError('New PIN must be exactly 4 digits (0-9)');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PIN and Confirm PIN do not match');
      return;
    }

    // Save new PIN
    storageService.setSecurityPin(newPin);
    const updated: UserSettings = {
      ...settings,
      securityPin: newPin,
      isAppLockEnabled: true,
    };
    onUpdateSettings(updated);
    storageService.saveSettings(updated);

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-900 dark:text-white animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {hasExistingPin ? 'Change Security PIN' : 'Set 4-Digit Security PIN'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Protect your personal loans and repayments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto animate-in zoom-in" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              PIN updated successfully!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {hasExistingPin && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center tracking-[0.5em] text-lg font-mono py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                New 4-Digit PIN
              </label>
              <input
                type="password"
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-lg font-mono py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
                autoFocus={!hasExistingPin}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Confirm New 4-Digit PIN
              </label>
              <input
                type="password"
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-lg font-mono py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={newPin.length !== 4 || confirmPin.length !== 4}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                Save PIN
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

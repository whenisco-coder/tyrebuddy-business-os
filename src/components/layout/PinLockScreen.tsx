import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { ShieldCheck, Lock, Delete } from 'lucide-react';

export const PinLockScreen: React.FC = () => {
  const { authenticate, authenticateWithPassword, settings } = useStore();
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [usePasswordFallback, setUsePasswordFallback] = useState(false);
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 6) {
      const next = pin + digit;
      setPin(next);
      setError(false);
      if (next.length >= 4) {
        // Test auto authenticate
        setTimeout(() => {
          if (!authenticate(next)) {
            if (next.length === (settings.pin || '1234').length) {
              setError(true);
            }
          }
        }, 100);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usePasswordFallback) {
      if (!authenticateWithPassword(password)) {
        setError(true);
      }
    } else {
      if (!authenticate(pin)) {
        setError(true);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/90 backdrop-blur-sm p-4 text-white">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 p-8 shadow-2xl flex flex-col items-center">
        {/* Brand Header */}
        <div className="w-12 h-12 bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4 text-neutral-200">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-white mb-1">
          {settings.businessName}
        </h1>
        <p className="text-xs text-neutral-400 mb-6">
          Offline app · Data on this device
        </p>

        {/* Toggle between Screen 1 (PIN) and Screen 2 (Password Fallback) */}
        {!usePasswordFallback ? (
          <>
            {/* Screen 1: PIN entry */}
            <div className="flex items-center gap-3 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                    pin.length > i
                      ? 'bg-white border-white scale-110'
                      : 'border-neutral-600 bg-neutral-800'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-400 mb-4 font-mono">
                Incorrect PIN. Default is 1234.
              </p>
            )}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 w-full mb-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(num)}
                  className="h-14 bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700/60 text-lg font-mono font-semibold transition active:scale-95 flex items-center justify-center text-white"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin('')}
                className="h-14 bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 text-xs font-mono uppercase tracking-wider text-neutral-400 transition flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-14 bg-neutral-800/80 hover:bg-neutral-700 border border-neutral-700/60 text-lg font-mono font-semibold transition active:scale-95 flex items-center justify-center text-white"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="Backspace"
                className="h-14 bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800 text-neutral-300 transition flex items-center justify-center active:scale-95"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-2">
              <button
                type="submit"
                className="w-full py-3 bg-neutral-100 hover:bg-white text-neutral-950 font-semibold text-sm transition flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Unlock with PIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsePasswordFallback(true);
                  setError(false);
                }}
                className="w-full py-2 text-neutral-400 hover:text-white text-xs font-mono transition text-center"
              >
                Forgot PIN? Use Password Fallback →
              </button>
            </form>
          </>
        ) : (
          /* Screen 2: Password fallback screen */
          <form onSubmit={handleSubmit} className="w-full space-y-4 my-2">
            <div>
              <label className="block text-xs font-mono text-neutral-400 mb-1.5 uppercase">
                Administrator Password:
              </label>
              <input
                type="password"
                autoFocus
                placeholder="Enter password..."
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 text-white font-mono text-sm focus:outline-none focus:border-white"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 font-mono">
                Incorrect password. Default is admin123 or tyrebuddy2026.
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-neutral-100 hover:bg-white text-neutral-950 font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Verify Password & Unlock
            </button>

            <button
              type="button"
              onClick={() => {
                setUsePasswordFallback(false);
                setError(false);
              }}
              className="w-full py-2 text-neutral-400 hover:text-white text-xs font-mono transition text-center"
            >
              ← Back to PIN Entry
            </button>
          </form>
        )}

        <p className="mt-4 text-[11px] text-neutral-500 font-mono text-center">
          Default Operator PIN: 1234 · Password: admin123
        </p>
      </div>
    </div>
  );
};

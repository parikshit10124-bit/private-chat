import React, { useState } from 'react';
import { Lock, Unlock, LogOut, ShieldCheck, KeyRound } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';
import { useAuth } from '../../context/AuthContext';

export default function AutoLockOverlay() {
  const { isLocked, unlock } = useSecurity();
  const { user, logout } = useAuth();

  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  if (!isLocked || !user) return null;

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!inputVal) return;

    setLoading(true);
    setError('');

    const res = await unlock(inputVal);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Incorrect unlock PIN or password');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else {
      setInputVal('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-fade-in select-none">
      <div className={`w-full max-w-sm p-8 bg-white dark:bg-chat-darkSidebar rounded-3xl shadow-2xl border border-slate-200/50 dark:border-chat-darkBorder text-center transition-all ${shake ? 'animate-shake' : ''}`}>
        {/* Lock Icon Badge */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-chat-primary/15 text-chat-primary flex items-center justify-center mb-4 ring-8 ring-chat-primary/5">
          <Lock className="w-7 h-7" />
        </div>

        {/* User Identity */}
        <div className="mb-6">
          <img
            src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`}
            alt={user.displayName}
            className="w-16 h-16 rounded-full mx-auto mb-2 border-2 border-chat-primary/40 object-cover shadow-sm"
          />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {user.displayName}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Private Instance Locked
          </p>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="password"
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                if (error) setError('');
              }}
              placeholder="Enter PIN or Account Password"
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-chat-darkHeader border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-100 focus:outline-none focus:border-chat-primary focus:ring-1 focus:ring-chat-primary transition-all text-center placeholder-slate-400"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-500 font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !inputVal}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-chat-primary hover:bg-chat-primaryHover disabled:opacity-50 rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            <Unlock className="w-4 h-4" />
            {loading ? 'Verifying...' : 'Unlock Session'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-chat-darkBorder flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero-Knowledge Protected</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 hover:text-rose-500 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

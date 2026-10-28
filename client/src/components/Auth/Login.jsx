import React, { useState } from 'react';
import { Lock, User, KeyRound, ShieldCheck, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../UI/ThemeToggle';

export default function Login({ onSwitchToRegister }) {
  const { login, instanceStatus, error: authError } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setLocalError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setLocalError('');

    const res = await login(username, password);
    setLoading(false);

    if (!res.success) {
      setLocalError(res.error || 'Login failed. Check your credentials.');
    }
  };

  const isFull = instanceStatus.isFull;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-chat-lightBg dark:bg-chat-darkBg chat-pattern-light dark:chat-pattern-dark relative select-none">
      {/* Top Bar Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white/90 dark:bg-chat-darkSidebar/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-chat-darkBorder overflow-hidden animate-slide-up">
        {/* Header Visual */}
        <div className="p-8 text-center bg-gradient-to-b from-chat-primary/10 via-emerald-500/5 to-transparent border-b border-slate-100 dark:border-chat-darkBorder">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-chat-primary text-white flex items-center justify-center shadow-lg shadow-chat-primary/30 ring-8 ring-chat-primary/10">
            <Lock className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
            Private 1-on-1 Line
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Exclusive, zero-knowledge encrypted messaging
          </p>

          {/* Instance Quota Badge */}
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2-User Isolated Instance ({instanceStatus.userCount}/2 Registered)</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {(localError || authError) && (
            <div className="flex items-center gap-2 p-3 mb-5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900/50">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{localError || authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alice"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-chat-darkHeader border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-chat-primary focus:ring-1 focus:ring-chat-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-chat-darkHeader border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-chat-primary focus:ring-1 focus:ring-chat-primary transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold text-white bg-chat-primary hover:bg-chat-primaryHover disabled:opacity-50 rounded-xl shadow-lg shadow-chat-primary/20 transition-all active:scale-[0.98] mt-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Enter Private Chat</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Registration or Quota Full notice */}
          <div className="mt-6 pt-5 text-center border-t border-slate-100 dark:border-chat-darkBorder">
            {!isFull ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Seat available?{' '}
                <button
                  type="button"
                  onClick={onSwitchToRegister}
                  className="font-bold text-chat-primary hover:underline"
                >
                  Register Account ({instanceStatus.userCount === 0 ? 'Be 1st User' : 'Claim 2nd Seat'})
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Instance Full: 2/2 accounts occupied</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

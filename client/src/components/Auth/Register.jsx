import React, { useState, useEffect } from 'react';
import { Lock, User, KeyRound, ShieldCheck, ArrowRight, UserPlus, ShieldAlert, Ticket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../UI/ThemeToggle';

export default function Register({ onSwitchToLogin }) {
  const { register, instanceStatus } = useAuth();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Extract ?invite=... from URL if user arrived via shared link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) {
      setInviteCode(code.trim().toUpperCase());
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !displayName || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (instanceStatus.userCount === 1 && !inviteCode.trim()) {
      setError('An invite code is required to claim the second seat.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await register(
      username.toLowerCase().trim(),
      displayName.trim(),
      password,
      inviteCode.trim()
    );

    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Registration failed.');
    }
  };

  const isFirstUser = instanceStatus.userCount === 0;
  const isSecondUser = instanceStatus.userCount === 1;
  const isFull = instanceStatus.userCount >= 2;

  if (isFull) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-chat-lightBg dark:bg-chat-darkBg chat-pattern-light dark:chat-pattern-dark">
        <div className="w-full max-w-md p-8 bg-white dark:bg-chat-darkSidebar rounded-3xl shadow-2xl border border-slate-200 dark:border-chat-darkBorder text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Registration Closed
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            This private instance is strictly limited to 2 accounts and both seats are currently filled.
          </p>
          <button
            onClick={onSwitchToLogin}
            className="w-full py-2.5 text-xs font-semibold text-white bg-chat-primary hover:bg-chat-primaryHover rounded-xl shadow-md transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-chat-lightBg dark:bg-chat-darkBg chat-pattern-light dark:chat-pattern-dark relative select-none">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white/90 dark:bg-chat-darkSidebar/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-chat-darkBorder overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-8 text-center bg-gradient-to-b from-chat-primary/10 via-emerald-500/5 to-transparent border-b border-slate-100 dark:border-chat-darkBorder">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-chat-primary text-white flex items-center justify-center shadow-lg shadow-chat-primary/30 ring-8 ring-chat-primary/10">
            <UserPlus className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
            {isFirstUser ? 'Initialize Private Chat' : 'Join Private Chat'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isFirstUser
              ? 'Creating Seat 1 of 2 (Primary Host)'
              : 'Claiming Seat 2 of 2 (Invited Partner)'}
          </p>
        </div>

        {/* Body Form */}
        <div className="p-8">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-900/50">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alice"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-chat-darkHeader border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-100 focus:outline-none focus:border-chat-primary focus:ring-1 focus:ring-chat-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Username (for sign in)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alice"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-chat-darkHeader border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-100 focus:outline-none focus:border-chat-primary focus:ring-1 focus:ring-chat-primary font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-chat-darkHeader border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-100 focus:outline-none focus:border-chat-primary focus:ring-1 focus:ring-chat-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-chat-darkHeader border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-100 focus:outline-none focus:border-chat-primary focus:ring-1 focus:ring-chat-primary"
                />
              </div>
            </div>

            {/* Invite Code field (only for user 2) */}
            {isSecondUser && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Invite Code
                </label>
                <div className="relative">
                  <Ticket className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 8A3F2C1D"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-chat-darkHeader border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-100 font-mono tracking-widest uppercase focus:outline-none focus:border-chat-primary focus:ring-1 focus:ring-chat-primary"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Obtain this code from User #1 to link into this private conversation.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold text-white bg-chat-primary hover:bg-chat-primaryHover disabled:opacity-50 rounded-xl shadow-lg shadow-chat-primary/20 transition-all active:scale-[0.98] mt-3"
            >
              {loading ? (
                <span>Registering Account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 text-center border-t border-slate-100 dark:border-chat-darkBorder">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-bold text-chat-primary hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

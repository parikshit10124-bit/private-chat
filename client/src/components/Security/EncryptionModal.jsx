import React, { useState } from 'react';
import { Shield, Key, Copy, Check, Lock, AlertCircle, X } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';

export default function EncryptionModal({ isOpen, onClose }) {
  const { e2eePassphrase, setE2eePassphrase, isE2EEActive, safetyFingerprint } = useSecurity();
  const [passphraseInput, setPassphraseInput] = useState(e2eePassphrase || '');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setE2eePassphrase(passphraseInput);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    setPassphraseInput('');
    setE2eePassphrase('');
    onClose();
  };

  const copyFingerprint = () => {
    if (safetyFingerprint) {
      navigator.clipboard.writeText(safetyFingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-chat-darkSidebar rounded-2xl shadow-2xl border border-slate-200 dark:border-chat-darkBorder overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-chat-darkBorder bg-slate-50 dark:bg-chat-darkHeader">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-chat-primary/10 text-chat-primary">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">
                End-to-End Encryption
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Client-Side AES-256-GCM Layer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-chat-darkHeader/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-chat-darkBorder flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-chat-primary shrink-0 mt-0.5" />
            <p>
              When a shared secret key is set, all message text is encrypted in your browser using <strong>256-bit AES-GCM</strong> before leaving your device. Even if the server database is compromised, messages remain unreadable ciphertext.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Pre-Shared Secret Passphrase
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={passphraseInput}
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  placeholder="e.g. quantum-signal-passphrase-2026"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-chat-darkHeader border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-100 focus:outline-none focus:border-chat-primary focus:ring-1 focus:ring-chat-primary font-mono transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Both participants must enter the exact same secret passphrase to decrypt messages.
              </p>
            </div>

            {/* Safety Numbers / Fingerprint */}
            {safetyFingerprint && (
              <div className="bg-slate-50 dark:bg-chat-darkHeader p-3.5 rounded-xl border border-slate-200 dark:border-chat-darkBorder space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Safety Verification Numbers
                  </span>
                  <button
                    type="button"
                    onClick={copyFingerprint}
                    className="flex items-center gap-1 text-xs text-chat-primary hover:underline font-medium"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="font-mono text-sm tracking-widest text-center py-2 bg-white dark:bg-chat-darkSidebar rounded-lg text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-chat-darkBorder select-all">
                  {safetyFingerprint}
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Compare these numbers with your peer to confirm no man-in-the-middle tampering.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {isE2EEActive ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-rose-500 hover:text-rose-600 font-medium"
                >
                  Disable Encryption
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-chat-darkHeader rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!passphraseInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-chat-primary hover:bg-chat-primaryHover disabled:opacity-50 rounded-xl shadow-sm transition-all"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Saved & Verified
                    </>
                  ) : (
                    'Activate E2EE'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

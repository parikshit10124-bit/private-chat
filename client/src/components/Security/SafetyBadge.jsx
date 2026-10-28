import React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';

export default function SafetyBadge({ onClick }) {
  const { isE2EEActive } = useSecurity();

  return (
    <button
      onClick={onClick}
      title={isE2EEActive ? "AES-256-GCM End-to-End Encryption Active" : "Click to set client-side encryption key"}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
        isE2EEActive
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
      }`}
    >
      {isE2EEActive ? (
        <>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline">E2EE Locked</span>
        </>
      ) : (
        <>
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden sm:inline">Set E2EE Key</span>
        </>
      )}
    </button>
  );
}

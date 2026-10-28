import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { generateSafetyFingerprint } from '../utils/crypto';
import { useAuth } from './AuthContext';
import { apiFetch } from '../utils/api';

const SecurityContext = createContext(null);

export const SecurityProvider = ({ children }) => {
  const { user } = useAuth();

  // E2EE State (kept in sessionStorage for the session or memory)
  const [e2eePassphrase, setE2eePassphraseState] = useState(() => {
    return sessionStorage.getItem('private_chat_e2ee_key') || '';
  });
  const [safetyFingerprint, setSafetyFingerprint] = useState('');
  const isE2EEActive = Boolean(e2eePassphrase && e2eePassphrase.trim().length > 0);

  // Auto-Lock State
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeoutMinutes, setLockTimeoutMinutes] = useState(() => {
    const saved = localStorage.getItem('private_chat_lock_timeout');
    return saved !== null ? parseInt(saved, 10) : 5; // Default 5 minutes
  });
  const [blurProtection, setBlurProtection] = useState(() => {
    return localStorage.getItem('private_chat_blur_protection') === 'true';
  });

  const idleTimerRef = useRef(null);

  // Compute safety fingerprint whenever passphrase changes
  useEffect(() => {
    if (e2eePassphrase) {
      generateSafetyFingerprint(e2eePassphrase).then(fp => setSafetyFingerprint(fp));
    } else {
      setSafetyFingerprint('');
    }
  }, [e2eePassphrase]);

  const setE2eePassphrase = (pass) => {
    const clean = pass.trim();
    setE2eePassphraseState(clean);
    if (clean) {
      sessionStorage.setItem('private_chat_e2ee_key', clean);
    } else {
      sessionStorage.removeItem('private_chat_e2ee_key');
    }
  };

  const lockNow = useCallback(() => {
    if (user) {
      setIsLocked(true);
    }
  }, [user]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    if (!user || isLocked || lockTimeoutMinutes <= 0) return;

    idleTimerRef.current = setTimeout(() => {
      console.log('🔒 Auto-lock triggered due to inactivity');
      setIsLocked(true);
    }, lockTimeoutMinutes * 60 * 1000);
  }, [user, isLocked, lockTimeoutMinutes]);

  // Activity event listeners
  useEffect(() => {
    if (!user || isLocked || lockTimeoutMinutes <= 0) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetIdleTimer();

    events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    resetIdleTimer();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, isLocked, lockTimeoutMinutes, resetIdleTimer]);

  // Tab switch / Window blur lock (Camouflage mode)
  useEffect(() => {
    if (!user || !blurProtection || isLocked) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, blurProtection, isLocked]);

  const updateLockTimeout = (mins) => {
    setLockTimeoutMinutes(mins);
    localStorage.setItem('private_chat_lock_timeout', mins.toString());
  };

  const toggleBlurProtection = (enabled) => {
    setBlurProtection(enabled);
    localStorage.setItem('private_chat_blur_protection', enabled ? 'true' : 'false');
  };

  // Verify PIN or Account password to unlock
  const unlock = async (pinOrPassword) => {
    try {
      const isDigitsOnly = /^\d+$/.test(pinOrPassword);
      const payload = isDigitsOnly ? { pin: pinOrPassword } : { password: pinOrPassword };

      const res = await apiFetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid unlock code');
      }

      setIsLocked(false);
      resetIdleTimer();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const setPin = async (newPin) => {
    const res = await apiFetch('/api/auth/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update PIN');
    return data;
  };

  return (
    <SecurityContext.Provider
      value={{
        e2eePassphrase,
        setE2eePassphrase,
        isE2EEActive,
        safetyFingerprint,
        isLocked,
        lockNow,
        unlock,
        setPin,
        lockTimeoutMinutes,
        updateLockTimeout,
        blurProtection,
        toggleBlurProtection
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => useContext(SecurityContext);

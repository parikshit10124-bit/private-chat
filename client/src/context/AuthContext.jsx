import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [peer, setPeer] = useState(null);
  const [instanceStatus, setInstanceStatus] = useState({
    userCount: 0,
    maxUsers: 2,
    isFull: false,
    requiresInvite: false,
    hasActiveInvite: false,
    activeInviteCode: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check instance status and current session
  const checkAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch public instance status
      const statusRes = await apiFetch('/api/auth/status');
      const statusData = await statusRes.json();
      if (statusData.success) {
        setInstanceStatus(statusData.data);
      }

      // 2. Fetch authenticated session
      const meRes = await apiFetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.success) {
          setUser(meData.data.user);
          setPeer(meData.data.peer);
          setInstanceStatus(prev => ({
            ...prev,
            userCount: meData.data.userCount,
            isFull: meData.data.isFull,
            activeInviteCode: meData.data.activeInviteCode
          }));
        }
      } else {
        setUser(null);
        setPeer(null);
      }
    } catch (err) {
      console.error('Auth verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      setError(null);
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.data?.token) {
        localStorage.setItem('chat_token', data.data.token);
      }

      setUser(data.data.user);
      // Re-fetch peer and status
      await checkAuth();
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const register = async (username, displayName, password, inviteCode) => {
    try {
      setError(null);
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName, password, inviteCode })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      if (data.data?.token) {
        localStorage.setItem('chat_token', data.data.token);
      }

      setUser(data.data.user);
      await checkAuth();
      return { success: true, data: data.data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('chat_token');
      setUser(null);
      setPeer(null);
      await checkAuth();
    }
  };

  const generateInvite = async () => {
    try {
      const res = await apiFetch('/api/auth/invite', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setInstanceStatus(prev => ({ ...prev, activeInviteCode: data.data.inviteCode }));
        return data.data.inviteCode;
      }
      throw new Error(data.message || 'Could not generate invite code');
    } catch (err) {
      console.error('Generate invite error:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        peer,
        instanceStatus,
        loading,
        error,
        login,
        register,
        logout,
        checkAuth,
        generateInvite
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

/**
 * Unified API Client & Environment Configuration
 * Seamlessly supports both:
 * 1. Monolithic / Local deployment (relative URLs to same origin)
 * 2. Decoupled deployment (Frontend on Vercel, Backend on Render/Railway/Fly.io)
 */

export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/+$/, '');

export const getApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${SERVER_URL}${cleanEndpoint}`;
};

export const getSocketUrl = () => {
  return SERVER_URL || '/';
};

export const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const token = localStorage.getItem('chat_token');
  const base = `${SERVER_URL}${cleanPath}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
};

export const apiFetch = async (endpoint, options = {}) => {
  const url = getApiUrl(endpoint);
  const token = localStorage.getItem('chat_token');

  const headers = {
    ...(options.headers || {})
  };

  // Add Bearer token header if present in localStorage
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
};

/**
 * Date and time formatting helpers styled after WhatsApp / Signal conventions
 */

export function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(typeof timestamp === 'number' && timestamp < 1e11 ? timestamp * 1000 : timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateSeparator(timestamp) {
  if (!timestamp) return '';
  const date = new Date(typeof timestamp === 'number' && timestamp < 1e11 ? timestamp * 1000 : timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return 'TODAY';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';

  // Format as e.g. "October 24, 2026"
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).toUpperCase();
}

export function isSameDay(ts1, ts2) {
  if (!ts1 || !ts2) return false;
  const d1 = new Date(typeof ts1 === 'number' && ts1 < 1e11 ? ts1 * 1000 : ts1);
  const d2 = new Date(typeof ts2 === 'number' && ts2 < 1e11 ? ts2 * 1000 : ts2);
  return d1.toDateString() === d2.toDateString();
}

export function formatLastSeen(isOnline, lastSeen) {
  if (isOnline) return 'online';
  if (!lastSeen) return 'offline';

  const date = new Date(typeof lastSeen === 'number' && lastSeen < 1e11 ? lastSeen * 1000 : lastSeen);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `last seen today at ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `last seen yesterday at ${timeStr}`;
  }

  return `last seen ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

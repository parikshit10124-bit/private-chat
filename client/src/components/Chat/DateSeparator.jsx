import React from 'react';
import { formatDateSeparator } from '../../utils/dateUtils';

export default function DateSeparator({ timestamp }) {
  const dateText = formatDateSeparator(timestamp);
  if (!dateText) return null;

  return (
    <div className="flex items-center justify-center my-4 select-none">
      <div className="px-3.5 py-1 text-[11px] font-semibold tracking-wider text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-chat-darkHeader/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200/50 dark:border-chat-darkBorder">
        {dateText}
      </div>
    </div>
  );
}

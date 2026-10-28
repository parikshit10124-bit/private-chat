import React from 'react';
import { Search, X } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function SearchBar({ onClose }) {
  const { searchQuery, setSearchQuery, filteredMessages, messages } = useChat();

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-chat-lightHeader dark:bg-chat-darkHeader border-b border-chat-lightBorder dark:border-chat-darkBorder animate-fade-in">
      <div className="relative flex-1 flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversation..."
          autoFocus
          className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg bg-white dark:bg-chat-darkSidebar text-slate-800 dark:text-slate-100 placeholder-slate-400 border border-transparent focus:border-chat-primary focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {searchQuery && (
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
          {filteredMessages.length} of {messages.length}
        </span>
      )}

      {onClose && (
        <button
          onClick={() => {
            setSearchQuery('');
            onClose();
          }}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          title="Close search"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

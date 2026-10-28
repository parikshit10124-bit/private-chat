import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Lock,
  ArrowDown,
  Shield,
  UserPlus,
  Share2,
  Check,
  Copy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useChat } from '../../context/ChatContext';
import { formatLastSeen, isSameDay } from '../../utils/dateUtils';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import DateSeparator from './DateSeparator';
import SearchBar from '../UI/SearchBar';
import SafetyBadge from '../Security/SafetyBadge';
import MediaViewerModal from './MediaViewerModal';

export default function ChatInterface({ onOpenSidebar, onOpenE2EEModal }) {
  const { user, peer, instanceStatus } = useAuth();
  const { peerOnline, peerLastSeen, peerTyping } = useSocket();
  const { filteredMessages, messages, searchQuery, deleteMessage } = useChat();

  const [showSearch, setShowSearch] = useState(false);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [peer?.id]);

  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom(true);
    }
  }, [messages.length]);

  // Track scroll position to show/hide "Scroll to bottom" floating button
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isUp);
  };

  const handleCopyInvite = () => {
    if (instanceStatus.activeInviteCode) {
      const inviteUrl = `${window.location.origin}?invite=${instanceStatus.activeInviteCode}`;
      navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-chat-lightBg dark:bg-chat-darkBg overflow-hidden">
      {/* 1. Header Bar */}
      <header className="flex items-center justify-between px-3 md:px-4 py-2.5 bg-chat-lightHeader dark:bg-chat-darkHeader border-b border-chat-lightBorder dark:border-chat-darkBorder z-20">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Sidebar Toggle Button */}
          <button
            onClick={onOpenSidebar}
            className="md:hidden p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {peer ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={peer.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${peer.displayName}`}
                  alt={peer.displayName}
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                />
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white dark:border-chat-darkHeader rounded-full ${
                    peerOnline ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
              </div>

              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                  {peer.displayName}
                </h1>
                <p className="text-[11px] truncate">
                  {peerTyping ? (
                    <span className="text-chat-primary font-semibold italic animate-pulse">
                      typing...
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      {formatLastSeen(peerOnline, peerLastSeen)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-chat-primary/20 text-chat-primary flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Awaiting Peer
                </h1>
                <p className="text-[11px] text-slate-400">1 of 2 seats registered</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          <SafetyBadge onClick={onOpenE2EEModal} />

          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-full transition-colors ${
              showSearch
                ? 'bg-chat-primary/15 text-chat-primary'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Search Messages"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. Optional Inline Search Bar */}
      {showSearch && (
        <SearchBar onClose={() => setShowSearch(false)} />
      )}

      {/* 3. Messages Stream Body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 sm:p-4 chat-pattern-light dark:chat-pattern-dark relative"
      >
        {/* End-to-End Encryption Security Pill at Top */}
        <div className="flex items-center justify-center my-3">
          <div className="max-w-md px-4 py-2 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-xl text-center text-xs text-amber-800 dark:text-amber-300 leading-relaxed shadow-sm">
            <div className="flex items-center justify-center gap-1.5 font-semibold mb-0.5 text-[11px] uppercase tracking-wide">
              <Lock className="w-3.5 h-3.5" />
              <span>Private 1-on-1 Line</span>
            </div>
            Messages and calls are secured with end-to-end encryption. No outside third party or server can read your communications.
          </div>
        </div>

        {/* Peer Waiting Card if Seat 2 is Empty */}
        {!peer && (
          <div className="max-w-md mx-auto my-8 p-6 bg-white dark:bg-chat-darkSidebar rounded-3xl shadow-xl border border-slate-200/80 dark:border-chat-darkBorder text-center space-y-4 animate-slide-up">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-chat-primary/10 text-chat-primary flex items-center justify-center ring-8 ring-chat-primary/5">
              <Share2 className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Invite Your Partner to Chat
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                This private messaging instance is exclusively reserved for two accounts. Share your invite link to let them register and start chatting.
              </p>
            </div>

            {instanceStatus.activeInviteCode && (
              <div className="p-3 bg-slate-50 dark:bg-chat-darkHeader rounded-2xl border border-slate-200 dark:border-chat-darkBorder space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Exclusive Invite Code
                </span>
                <div className="font-mono text-lg font-bold tracking-widest text-chat-primary">
                  {instanceStatus.activeInviteCode}
                </div>
                <button
                  onClick={handleCopyInvite}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-chat-primary hover:bg-chat-primaryHover rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? 'Invite Link Copied to Clipboard' : 'Copy Invite Link'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Message List with WhatsApp-Style Date Separators */}
        {filteredMessages.map((msg, index) => {
          const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
          const showDateSeparator = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
          const isMe = msg.senderId === user?.id;

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <DateSeparator timestamp={msg.createdAt} />
              )}
              <MessageBubble
                message={msg}
                isMe={isMe}
                onOpenMedia={(url) => setSelectedMediaUrl(url)}
                onDelete={(msgId, mode) => deleteMessage(msgId, mode)}
                searchQuery={searchQuery}
              />
            </React.Fragment>
          );
        })}

        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-20 right-6 p-2.5 bg-white dark:bg-chat-darkSidebar text-slate-600 dark:text-slate-300 hover:text-chat-primary rounded-full shadow-lg border border-slate-200 dark:border-chat-darkBorder transition-all hover:scale-105 active:scale-95 z-20"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* 4. Input Footer */}
      {peer && (
        <MessageInput />
      )}

      {/* 5. Fullscreen Media Modal */}
      <MediaViewerModal
        mediaUrl={selectedMediaUrl}
        onClose={() => setSelectedMediaUrl(null)}
      />
    </div>
  );
}

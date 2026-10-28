import React, { useState } from 'react';
import {
  Lock,
  LogOut,
  Shield,
  Copy,
  Check,
  UserPlus,
  Sparkles,
  KeyRound,
  Eye,
  Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useSecurity } from '../../context/SecurityContext';
import { useChat } from '../../context/ChatContext';
import ThemeToggle from '../UI/ThemeToggle';
import { formatLastSeen, formatMessageTime } from '../../utils/dateUtils';

export default function Sidebar({ onOpenE2EEModal, isMobileOpen, onCloseMobile }) {
  const { user, peer, instanceStatus, logout, generateInvite } = useAuth();
  const { peerOnline, peerLastSeen, peerTyping } = useSocket();
  const { lockNow, isE2EEActive, lockTimeoutMinutes, updateLockTimeout, blurProtection, toggleBlurProtection } = useSecurity();
  const { messages } = useChat();

  const [copiedCode, setCopiedCode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Get last message in conversation
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  const handleCopyInvite = async (code) => {
    try {
      const inviteUrl = `${window.location.origin}?invite=${code}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite:', err);
    }
  };

  const handleCreateInvite = async () => {
    try {
      setGenerating(true);
      await generateInvite();
    } catch (err) {
      alert('Error creating invite: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-30 w-full sm:w-80 md:w-96 flex flex-col bg-chat-lightSidebar dark:bg-chat-darkSidebar border-r border-chat-lightBorder dark:border-chat-darkBorder transition-transform duration-300 select-none ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* 1. Header (User profile & action bar) */}
      <div className="flex items-center justify-between px-4 py-3 bg-chat-lightHeader dark:bg-chat-darkHeader border-b border-chat-lightBorder dark:border-chat-darkBorder">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.displayName}`}
              alt={user?.displayName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-chat-primary/30"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-chat-darkHeader rounded-full" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {user?.displayName}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
              @{user?.username}
            </p>
          </div>
        </div>

        {/* Top utility icons */}
        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <ThemeToggle />

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Privacy Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={lockNow}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-amber-500"
            title="Lock Chat Now"
          >
            <Lock className="w-5 h-5" />
          </button>

          <button
            onClick={logout}
            className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Privacy & Security Settings Dropdown Panel */}
      {showSettings && (
        <div className="p-4 bg-slate-50 dark:bg-chat-darkHeader/80 border-b border-chat-lightBorder dark:border-chat-darkBorder space-y-3 animate-fade-in text-xs">
          <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-chat-primary" />
              Instance Security
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>

          {/* E2EE Passphrase Shortcut */}
          <div className="flex items-center justify-between py-1 border-t border-slate-200/60 dark:border-chat-darkBorder">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-200">Client-Side E2EE</p>
              <p className="text-[10px] text-slate-500">AES-256-GCM cipher layer</p>
            </div>
            <button
              onClick={() => {
                setShowSettings(false);
                onOpenE2EEModal();
              }}
              className="px-2.5 py-1 text-[11px] font-medium bg-chat-primary text-white rounded-lg hover:bg-chat-primaryHover"
            >
              {isE2EEActive ? 'Manage Key' : 'Setup Passphrase'}
            </button>
          </div>

          {/* Inactivity Auto-Lock timer setting */}
          <div className="flex items-center justify-between py-1 border-t border-slate-200/60 dark:border-chat-darkBorder">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-200">Auto-Lock Idle</p>
              <p className="text-[10px] text-slate-500">Locks screen when inactive</p>
            </div>
            <select
              value={lockTimeoutMinutes}
              onChange={(e) => updateLockTimeout(parseInt(e.target.value, 10))}
              className="py-1 px-2 text-[11px] rounded-lg bg-white dark:bg-chat-darkSidebar border border-slate-200 dark:border-chat-darkBorder text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value={1}>1 minute</option>
              <option value={2}>2 minutes</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={0}>Disabled</option>
            </select>
          </div>

          {/* Window Blur Lock Toggle */}
          <div className="flex items-center justify-between py-1 border-t border-slate-200/60 dark:border-chat-darkBorder">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-200">Camouflage on Blur</p>
              <p className="text-[10px] text-slate-500">Locks when switching tabs</p>
            </div>
            <button
              onClick={() => toggleBlurProtection(!blurProtection)}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                blurProtection ? 'bg-chat-primary' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  blurProtection ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* 3. Conversation Peer List (Single 1-on-1 Contact) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Private Channel
        </div>

        {peer ? (
          // Peer is Registered & Available
          <div
            onClick={onCloseMobile}
            className="group flex items-center gap-3.5 p-3 rounded-2xl bg-chat-lightHover dark:bg-chat-darkHover/90 border border-slate-200/60 dark:border-chat-darkBorder cursor-pointer transition-all shadow-sm"
          >
            {/* Avatar & Online Dot */}
            <div className="relative shrink-0">
              <img
                src={peer.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${peer.displayName}`}
                alt={peer.displayName}
                className="w-12 h-12 rounded-full object-cover"
              />
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white dark:border-chat-darkSidebar rounded-full ${
                  peerOnline ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
            </div>

            {/* Details & Last Message */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                  {peer.displayName}
                </h3>
                {lastMessage && (
                  <span className="text-[10px] text-slate-400">
                    {formatMessageTime(lastMessage.createdAt)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                {peerTyping ? (
                  <span className="text-chat-primary font-medium italic animate-pulse">
                    is typing...
                  </span>
                ) : lastMessage ? (
                  <span className="text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                    {lastMessage.type === 'image'
                      ? '📷 Photo'
                      : lastMessage.type === 'audio'
                      ? '🎤 Voice note'
                      : lastMessage.displayText}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">
                    {formatLastSeen(peerOnline, peerLastSeen)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Seat 2 is Empty - Show Invite Card
          <div className="p-4 bg-gradient-to-br from-chat-primary/10 via-emerald-500/5 to-transparent rounded-2xl border border-chat-primary/30 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-chat-primary/20 text-chat-primary flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>

            <div>
              <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                Seat #2 is Available
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                This private 1-on-1 instance is waiting for your partner. Share an invite link to establish your private line.
              </p>
            </div>

            {instanceStatus.activeInviteCode ? (
              <div className="space-y-2 pt-1">
                <div className="p-2.5 bg-white dark:bg-chat-darkHeader rounded-xl border border-slate-200 dark:border-chat-darkBorder font-mono text-sm tracking-widest font-bold text-chat-primary select-all">
                  {instanceStatus.activeInviteCode}
                </div>

                <button
                  onClick={() => handleCopyInvite(instanceStatus.activeInviteCode)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-white bg-chat-primary hover:bg-chat-primaryHover rounded-xl shadow-sm transition-all"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedCode ? 'Invite Link Copied!' : 'Copy Invite Link'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleCreateInvite}
                disabled={generating}
                className="w-full py-2 text-xs font-semibold text-white bg-chat-primary hover:bg-chat-primaryHover rounded-xl shadow-sm transition-all"
              >
                {generating ? 'Generating...' : 'Generate Invite Code'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Footer Instance Security & Database Summary */}
      <div className="p-3 bg-chat-lightHeader dark:bg-chat-darkHeader border-t border-chat-lightBorder dark:border-chat-darkBorder text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-chat-primary" />
            <span>Strict 2-User Capacity</span>
          </div>
          <span className="font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 font-mono">
            {instanceStatus.userCount}/2 Users
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-chat-darkBorder/60 text-[10px]">
          <span className="text-slate-400">Database Engine</span>
          <span className="font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {instanceStatus.dbEngine === 'postgres' ? '🐘 PostgreSQL / Supabase' : '💾 SQLite (WAL Mode)'}
          </span>
        </div>
      </div>
    </aside>
  );
}

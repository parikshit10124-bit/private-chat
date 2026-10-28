import React, { useState, useRef } from 'react';
import { Check, CheckCheck, Play, Pause, Lock, ShieldAlert, MoreVertical, Trash2, Copy } from 'lucide-react';
import { formatMessageTime } from '../../utils/dateUtils';
import { formatDuration } from '../../utils/audioUtils';
import { getMediaUrl } from '../../utils/api';

export default function MessageBubble({
  message,
  isMe,
  onOpenMedia,
  onDelete,
  searchQuery = ''
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const audioRef = useRef(null);

  // Audio Playback Handler
  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const handleCopy = () => {
    if (message.displayText) {
      navigator.clipboard.writeText(message.displayText);
      setCopied(true);
      setShowMenu(false);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Render status ticks for outgoing messages
  const renderStatusTicks = () => {
    if (!isMe) return null;

    if (message.status === 'read') {
      return (
        <span title="Read" className="text-chat-blueTick inline-flex items-center">
          <CheckCheck className="w-4 h-4 stroke-[2.5]" />
        </span>
      );
    }

    if (message.status === 'delivered') {
      return (
        <span title="Delivered" className="text-slate-400 dark:text-slate-300 inline-flex items-center">
          <CheckCheck className="w-4 h-4 stroke-[2]" />
        </span>
      );
    }

    // Default 'sent'
    return (
      <span title="Sent" className="text-slate-400 dark:text-slate-300 inline-flex items-center">
        <Check className="w-3.5 h-3.5 stroke-[2]" />
      </span>
    );
  };

  // Search query highlight helper
  const renderHighlightedText = (text) => {
    if (!searchQuery || !text) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-amber-300 dark:bg-amber-500/50 text-inherit px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className={`group relative flex w-full mb-1.5 px-3 md:px-6 select-text ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl p-2.5 shadow-sm transition-all text-sm ${
          isMe
            ? 'bg-chat-lightBubbleOut dark:bg-chat-darkBubbleOut text-slate-900 dark:text-slate-100 rounded-tr-none'
            : 'bg-chat-lightBubbleIn dark:bg-chat-darkBubbleIn text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-transparent'
        }`}
      >
        {/* Dropdown Options Trigger Button */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-full bg-black/10 dark:bg-black/30 hover:bg-black/20 text-slate-600 dark:text-slate-300"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <div className={`absolute top-6 ${isMe ? 'right-0' : 'left-0'} w-36 py-1 bg-white dark:bg-chat-darkSidebar rounded-xl shadow-xl border border-slate-200 dark:border-chat-darkBorder z-20 text-xs text-slate-700 dark:text-slate-200`}>
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-chat-darkHeader text-left"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete(message.id, 'me');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-chat-darkHeader text-left"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Delete for me</span>
              </button>
              {isMe && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(message.id, 'everyone');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete for everyone</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 1. Image Media View */}
        {message.type === 'image' && message.mediaUrl && (
          <div className="mb-2 overflow-hidden rounded-xl bg-black/5 dark:bg-black/20">
            <img
              src={getMediaUrl(message.mediaUrl)}
              alt="Shared media"
              onClick={() => onOpenMedia(getMediaUrl(message.mediaUrl))}
              className="max-h-80 w-auto rounded-xl object-cover cursor-pointer hover:opacity-95 transition-opacity"
              loading="lazy"
            />
          </div>
        )}

        {/* 2. Audio / Voice Note View */}
        {message.type === 'audio' && message.mediaUrl && (
          <div className="flex items-center gap-3 py-1 pr-4 min-w-[220px]">
            <audio
              ref={audioRef}
              src={getMediaUrl(message.mediaUrl)}
              onTimeUpdate={handleAudioTimeUpdate}
              onEnded={handleAudioEnded}
              preload="metadata"
            />
            <button
              onClick={togglePlayAudio}
              className={`p-2.5 rounded-full shrink-0 shadow-sm transition-all ${
                isMe
                  ? 'bg-chat-primary text-white hover:bg-chat-primaryHover'
                  : 'bg-chat-primary text-white hover:bg-chat-primaryHover'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <div className="flex-1 space-y-1">
              {/* Progress Bar / Waveform simulation */}
              <div
                className="relative h-2 bg-slate-300 dark:bg-slate-700 rounded-full cursor-pointer overflow-hidden"
                onClick={(e) => {
                  if (audioRef.current && audioRef.current.duration) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percent = clickX / rect.width;
                    audioRef.current.currentTime = percent * audioRef.current.duration;
                  }
                }}
              >
                <div
                  className="absolute top-0 bottom-0 left-0 bg-chat-primary rounded-full transition-all"
                  style={{ width: `${audioProgress}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>
                  {audioRef.current
                    ? formatDuration(audioRef.current.currentTime)
                    : '0:00'}
                </span>
                <span>
                  {message.mediaMeta?.duration
                    ? formatDuration(message.mediaMeta.duration)
                    : 'Voice note'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Text Message Content */}
        {message.content && message.type !== 'audio' && (
          <div className="pr-12 break-words leading-relaxed whitespace-pre-wrap font-sans">
            {message.decryptionFailed ? (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 italic text-xs py-0.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Encrypted message (Set E2EE passphrase to decrypt)</span>
              </span>
            ) : (
              renderHighlightedText(message.displayText)
            )}
          </div>
        )}

        {/* Message Metadata Footer (Timestamp, E2EE icon, Ticks) */}
        <div className="flex items-center justify-end gap-1.5 mt-1 -mb-1 text-[11px] text-slate-500 dark:text-slate-400 select-none">
          {message.isEncrypted && (
            <Lock className="w-3 h-3 text-slate-400 dark:text-slate-400 inline" title="AES-256-GCM Encrypted" />
          )}
          <span>{formatMessageTime(message.createdAt)}</span>
          {renderStatusTicks()}
        </div>
      </div>
    </div>
  );
}

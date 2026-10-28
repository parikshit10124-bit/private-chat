import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Mic, Send, Smile, Image as ImageIcon, X } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import VoiceRecorder from './VoiceRecorder';
import { apiFetch } from '../../utils/api';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🙏', '🔒', '✨', '👋'];

export default function MessageInput() {
  const { sendMessage } = useChat();
  const { emitTyping } = useSocket();

  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Handle typing debounce
  const handleTextChange = (e) => {
    setText(e.target.value);

    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(false);
    }, 2000);
  };

  // Send plain text message
  const handleSendText = async () => {
    const trimmed = text.trim();
    if (!trimmed && !selectedFile) return;

    try {
      if (selectedFile) {
        await handleUploadFile();
      } else if (trimmed) {
        setText('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        emitTyping(false);
        await sendMessage({ text: trimmed, type: 'text' });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Image Selection Handler
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Only image attachments are supported.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Upload and send image
  const handleUploadFile = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await apiFetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Image upload failed');
      }

      const caption = text.trim();
      setText('');
      clearSelectedFile();

      await sendMessage({
        text: caption,
        type: 'image',
        mediaUrl: data.data.mediaUrl,
        mediaMeta: data.data.mediaMeta
      });
    } catch (err) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Voice Note upload and send
  const handleSendAudio = async (audioBlob, duration) => {
    setIsRecording(false);

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', audioBlob, `voice-note-${Date.now()}.webm`);
      formData.append('duration', duration.toString());

      const res = await apiFetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Voice note upload failed');
      }

      await sendMessage({
        text: '',
        type: 'audio',
        mediaUrl: data.data.mediaUrl,
        mediaMeta: {
          ...data.data.mediaMeta,
          duration
        }
      });
    } catch (err) {
      alert(`Audio upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const addEmoji = (emoji) => {
    setText(prev => prev + emoji);
    setShowEmojis(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  return (
    <div className="relative px-3 py-2 bg-chat-lightHeader dark:bg-chat-darkHeader border-t border-chat-lightBorder dark:border-chat-darkBorder">
      {/* Quick Emoji Drawer */}
      {showEmojis && (
        <div className="absolute bottom-16 left-4 p-2 bg-white dark:bg-chat-darkSidebar rounded-2xl shadow-xl border border-slate-200 dark:border-chat-darkBorder flex items-center gap-2 z-20 animate-slide-up">
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
              className="p-1.5 text-lg hover:bg-slate-100 dark:hover:bg-chat-darkHeader rounded-lg transition-transform active:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Selected Image Preview Bar */}
      {imagePreview && (
        <div className="flex items-center gap-3 p-2 mb-2 bg-white dark:bg-chat-darkSidebar rounded-xl border border-slate-200 dark:border-chat-darkBorder animate-fade-in">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Attachment preview"
              className="w-14 h-14 object-cover rounded-lg"
            />
            <button
              onClick={clearSelectedFile}
              className="absolute -top-1.5 -right-1.5 p-0.5 bg-rose-500 text-white rounded-full shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
              {selectedFile?.name}
            </p>
            <p>{(selectedFile?.size / 1024).toFixed(1)} KB</p>
          </div>
          {uploading && (
            <span className="text-xs text-chat-primary font-medium animate-pulse">
              Uploading...
            </span>
          )}
        </div>
      )}

      {/* Voice Recording View or Standard Input */}
      {isRecording ? (
        <VoiceRecorder
          onSendAudio={handleSendAudio}
          onCancel={() => setIsRecording(false)}
        />
      ) : (
        <div className="flex items-end gap-2">
          {/* Action Buttons (Emojis & Attachment) */}
          <div className="flex items-center gap-0.5 mb-1 text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setShowEmojis(!showEmojis)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Emojis"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Attach Image"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Autosizing Textarea */}
          <div className="flex-1 bg-white dark:bg-chat-darkSidebar rounded-2xl border border-slate-200/80 dark:border-chat-darkBorder focus-within:border-chat-primary shadow-sm transition-all">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Type a message..."
              className="w-full px-3.5 py-2.5 text-sm bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none max-h-32 leading-relaxed"
            />
          </div>

          {/* Mic Button or Send Button */}
          {text.trim() || selectedFile ? (
            <button
              type="button"
              onClick={handleSendText}
              disabled={uploading}
              className="mb-1 p-2.5 bg-chat-primary hover:bg-chat-primaryHover text-white rounded-full shadow-md transition-all active:scale-95 shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRecording(true)}
              className="mb-1 p-2.5 text-slate-500 dark:text-slate-400 hover:text-chat-primary dark:hover:text-chat-primary hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors shrink-0"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

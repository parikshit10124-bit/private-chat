import React, { useState, useRef, useEffect } from 'react';
import { Mic, Trash2, Send, AlertCircle } from 'lucide-react';
import { formatDuration } from '../../utils/audioUtils';

export default function VoiceRecorder({ onSendAudio, onCancel }) {
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    startRecording();

    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);

      // Start elapsed timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setError('Microphone access denied. Please grant permission in browser.');
    }
  };

  const handleStopAndSend = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    mediaRecorderRef.current.onstop = async () => {
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      cleanup();
      onSendAudio(audioBlob, recordingTime);
    };

    mediaRecorderRef.current.stop();
  };

  const handleDiscard = () => {
    cleanup();
    onCancel();
  };

  if (error) {
    return (
      <div className="flex items-center justify-between w-full p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl text-xs">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={handleDiscard}
          className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 font-medium"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full py-1.5 px-3 bg-chat-lightHeader dark:bg-chat-darkHeader rounded-2xl animate-fade-in border border-slate-200/50 dark:border-chat-darkBorder">
      {/* Recording Indicator & Timer */}
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
        </span>

        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
          {formatDuration(recordingTime)}
        </span>

        {/* Animated equalizer wave */}
        <div className="hidden sm:flex items-center gap-1 h-5 px-2">
          <div className="w-1 bg-rose-500 rounded-full animate-wave-1" />
          <div className="w-1 bg-rose-500 rounded-full animate-wave-2" />
          <div className="w-1 bg-rose-500 rounded-full animate-wave-3" />
          <div className="w-1 bg-rose-500 rounded-full animate-wave-4" />
          <div className="w-1 bg-rose-500 rounded-full animate-wave-5" />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDiscard}
          className="p-2 text-slate-500 hover:text-rose-500 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Discard voice note"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={handleStopAndSend}
          className="p-2.5 text-white bg-chat-primary hover:bg-chat-primaryHover rounded-full shadow-md transition-all active:scale-95"
          title="Send voice note"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
}

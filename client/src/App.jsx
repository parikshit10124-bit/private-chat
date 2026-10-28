import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { SecurityProvider } from './context/SecurityContext';
import { ChatProvider } from './context/ChatContext';

import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Sidebar from './components/Chat/Sidebar';
import ChatInterface from './components/Chat/ChatInterface';
import EncryptionModal from './components/Security/EncryptionModal';
import AutoLockOverlay from './components/Security/AutoLockOverlay';

function MainApp() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showE2EEModal, setShowE2EEModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-chat-lightBg dark:bg-chat-darkBg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-chat-primary/20 border-t-chat-primary rounded-full animate-spin" />
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Connecting Secure Instance...
          </p>
        </div>
      </div>
    );
  }

  // If user is not authenticated
  if (!user) {
    if (authMode === 'register') {
      return <Register onSwitchToLogin={() => setAuthMode('login')} />;
    }
    return <Login onSwitchToRegister={() => setAuthMode('register')} />;
  }

  // Authenticated chat interface
  return (
    <SocketProvider>
      <SecurityProvider>
        <ChatProvider>
          <div className="flex h-screen w-screen overflow-hidden bg-chat-lightBg dark:bg-chat-darkBg select-none relative font-sans">
            {/* Mobile Backdrop */}
            {isMobileSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-xs animate-fade-in"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
            )}

            {/* Sidebar (Responsive drawer on mobile, static column on desktop) */}
            <Sidebar
              isMobileOpen={isMobileSidebarOpen}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
              onOpenE2EEModal={() => setShowE2EEModal(true)}
            />

            {/* Primary Chat Conversation Area */}
            <ChatInterface
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onOpenE2EEModal={() => setShowE2EEModal(true)}
            />

            {/* End-to-End Encryption Configuration Modal */}
            <EncryptionModal
              isOpen={showE2EEModal}
              onClose={() => setShowE2EEModal(false)}
            />

            {/* Inactivity & Idle Auto-Lock Screen Overlay */}
            <AutoLockOverlay />
          </div>
        </ChatProvider>
      </SecurityProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

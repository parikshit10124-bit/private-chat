import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getSocketUrl } from '../utils/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, peer } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [peerOnline, setPeerOnline] = useState(peer ? Boolean(peer.isOnline) : false);
  const [peerLastSeen, setPeerLastSeen] = useState(peer ? peer.lastSeen : null);
  const [peerTyping, setPeerTyping] = useState(false);

  // Sync initial peer state from auth
  useEffect(() => {
    if (peer) {
      setPeerOnline(Boolean(peer.isOnline));
      setPeerLastSeen(peer.lastSeen);
    }
  }, [peer]);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Connect to Socket.io server with credentials and auth token
    const token = localStorage.getItem('chat_token');
    const socketInstance = io(getSocketUrl(), {
      withCredentials: true,
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketInstance.on('connect', () => {
      console.log('⚡ [Socket.io] Connected to private messaging server:', socketInstance.id);
      setConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 [Socket.io] Disconnected:', reason);
      setConnected(false);
    });

    // Peer presence updates
    socketInstance.on('presence:status', ({ userId, isOnline, lastSeen }) => {
      setPeerOnline(Boolean(isOnline));
      if (lastSeen) {
        setPeerLastSeen(lastSeen);
      }
    });

    // Peer typing updates
    socketInstance.on('typing:indicator', ({ isTyping }) => {
      setPeerTyping(Boolean(isTyping));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.id]);

  const emitTyping = (isTyping) => {
    if (socket && connected) {
      socket.emit(isTyping ? 'typing:start' : 'typing:stop');
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        peerOnline,
        peerLastSeen,
        peerTyping,
        emitTyping
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

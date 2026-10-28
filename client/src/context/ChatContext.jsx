import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useSecurity } from './SecurityContext';
import { encryptText, decryptText } from '../utils/crypto';
import { apiFetch } from '../utils/api';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user, peer } = useAuth();
  const { socket, connected } = useSocket();
  const { e2eePassphrase, isE2EEActive } = useSecurity();

  const [rawMessages, setRawMessages] = useState([]);
  const [decryptedCache, setDecryptedCache] = useState({}); // id -> decrypted string
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch initial message history
  const fetchMessages = useCallback(async () => {
    if (!user || !peer) {
      setRawMessages([]);
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch('/api/chat/messages?limit=100');
      const data = await res.json();
      if (data.success && data.data.messages) {
        setRawMessages(data.data.messages);
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, peer?.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 2. Decrypt messages whenever rawMessages or e2eePassphrase changes
  useEffect(() => {
    let isCancelled = false;

    const decryptAll = async () => {
      const newCache = { ...decryptedCache };
      let updated = false;

      for (const msg of rawMessages) {
        if (msg.isEncrypted) {
          if (e2eePassphrase) {
            // Attempt decryption
            const decrypted = await decryptText(msg.encryptionMeta || msg.content, e2eePassphrase);
            if (decrypted !== null && newCache[msg.id] !== decrypted) {
              newCache[msg.id] = decrypted;
              updated = true;
            }
          } else {
            // Clear cache if passphrase removed
            if (newCache[msg.id]) {
              delete newCache[msg.id];
              updated = true;
            }
          }
        }
      }

      if (!isCancelled && updated) {
        setDecryptedCache(newCache);
      }
    };

    decryptAll();

    return () => {
      isCancelled = true;
    };
  }, [rawMessages, e2eePassphrase]);

  // 3. Mark incoming unread messages as read
  const markChatAsRead = useCallback(() => {
    if (!socket || !connected || !peer) return;

    // Find unread messages where current user is recipient
    const unread = rawMessages.filter(m => m.recipientId === user?.id && m.status !== 'read');
    if (unread.length > 0) {
      const messageIds = unread.map(m => m.id);
      socket.emit('messages:read', { senderId: peer.id, messageIds });

      // Optimistically update local status
      setRawMessages(prev =>
        prev.map(m => (m.recipientId === user?.id ? { ...m, status: 'read' } : m))
      );
    }
  }, [socket, connected, peer?.id, user?.id, rawMessages]);

  // Read receipt on focus/open
  useEffect(() => {
    markChatAsRead();

    const handleFocus = () => markChatAsRead();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [markChatAsRead]);

  // 4. Socket Listeners for Real-Time Events
  useEffect(() => {
    if (!socket) return;

    // A. Incoming message from peer
    const handleReceive = (newMsg) => {
      setRawMessages(prev => {
        // Prevent duplicates
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // If document is visible, immediately emit read receipt
      if (document.visibilityState === 'visible') {
        socket.emit('messages:read', { messageIds: [newMsg.id], senderId: newMsg.senderId });
      }
    };

    // B. Delivery / Read Receipts batch status update (Sent -> Delivered -> Read ticks)
    const handleBatchStatus = ({ messageIds, status, deliveredAt, readAt }) => {
      setRawMessages(prev =>
        prev.map(msg => {
          if (messageIds.includes(msg.id)) {
            return {
              ...msg,
              status,
              deliveredAt: deliveredAt || msg.deliveredAt,
              readAt: readAt || msg.readAt
            };
          }
          return msg;
        })
      );
    };

    // C. Single message deleted by peer
    const handleDeleted = ({ messageId }) => {
      setRawMessages(prev => prev.filter(m => m.id !== messageId));
    };

    socket.on('message:receive', handleReceive);
    socket.on('messages:batch_status_update', handleBatchStatus);
    socket.on('message:deleted', handleDeleted);

    return () => {
      socket.off('message:receive', handleReceive);
      socket.off('messages:batch_status_update', handleBatchStatus);
      socket.off('message:deleted', handleDeleted);
    };
  }, [socket]);

  // 5. Send message action
  const sendMessage = async ({ text = '', type = 'text', mediaUrl = null, mediaMeta = null }) => {
    if (!peer) {
      throw new Error('No peer user connected to receive message');
    }

    const tempId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let contentToSend = text;
    let isEncrypted = false;
    let encryptionMeta = null;

    // If client-side E2EE is active and there is text content
    if (isE2EEActive && text && text.trim().length > 0) {
      try {
        const encrypted = await encryptText(text.trim(), e2eePassphrase);
        if (encrypted) {
          isEncrypted = true;
          encryptionMeta = encrypted;
          contentToSend = JSON.stringify(encrypted);
        }
      } catch (err) {
        console.error('Failed to encrypt message text:', err);
      }
    }

    const messagePayload = {
      id: tempId,
      senderId: user.id,
      recipientId: peer.id,
      content: contentToSend,
      isEncrypted: isEncrypted ? 1 : 0,
      encryptionMeta,
      type,
      mediaUrl,
      mediaMeta,
      status: 'sent',
      createdAt: Math.floor(Date.now() / 1000)
    };

    // Optimistically store in state
    setRawMessages(prev => [...prev, messagePayload]);

    // If text was encrypted, cache plaintext locally for immediate display to sender
    if (isEncrypted) {
      setDecryptedCache(prev => ({ ...prev, [tempId]: text }));
    }

    // Emit via WebSockets
    if (socket && connected) {
      socket.emit('message:send', messagePayload, (response) => {
        if (response && response.success && response.message) {
          // Replace or reconcile with server record
          setRawMessages(prev =>
            prev.map(m => (m.id === tempId ? response.message : m))
          );
        }
      });
    }

    return tempId;
  };

  // 6. Delete message
  const deleteMessage = async (messageId, mode = 'everyone') => {
    try {
      await apiFetch(`/api/chat/messages/${messageId}?mode=${mode}`, { method: 'DELETE' });

      setRawMessages(prev => prev.filter(m => m.id !== messageId));

      if (mode === 'everyone' && socket && connected) {
        socket.emit('message:delete_everyone', { messageId });
      }
    } catch (err) {
      console.error('Delete message error:', err);
    }
  };

  // 7. Combined messages with decrypted text and search filtering
  const messages = useMemo(() => {
    return rawMessages.map(msg => {
      let displayText = msg.content;
      let decryptionFailed = false;

      if (msg.isEncrypted) {
        if (decryptedCache[msg.id]) {
          displayText = decryptedCache[msg.id];
        } else {
          decryptionFailed = true;
          displayText = '🔒 Encrypted message';
        }
      }

      return {
        ...msg,
        displayText,
        decryptionFailed
      };
    });
  }, [rawMessages, decryptedCache]);

  // 8. Filtered search results
  const filteredMessages = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return messages;
    }
    const q = searchQuery.toLowerCase().trim();
    return messages.filter(m => m.displayText.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        filteredMessages,
        rawMessages,
        loading,
        searchQuery,
        setSearchQuery,
        sendMessage,
        deleteMessage,
        markChatAsRead,
        refreshMessages: fetchMessages
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);

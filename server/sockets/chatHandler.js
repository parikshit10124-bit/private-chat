import { messageRepo, userRepo } from '../database/db.js';

// Map of userId -> Set of socket IDs (allowing multi-tab support)
const activeUserSockets = new Map();

export const setupChatSocketHandlers = (io) => {
  io.on('connection', async (socket) => {
    const user = socket.user;
    const userId = user.id;

    // 1. Register socket connection
    if (!activeUserSockets.has(userId)) {
      activeUserSockets.set(userId, new Set());
    }
    activeUserSockets.get(userId).add(socket.id);

    // Update database status
    await userRepo.updateOnlineStatus(userId, 1);

    // Fetch peer
    const peer = await userRepo.getPeer(userId);

    // Notify peer of online status
    if (peer && activeUserSockets.has(peer.id)) {
      for (const peerSocketId of activeUserSockets.get(peer.id)) {
        io.to(peerSocketId).emit('presence:status', {
          userId,
          isOnline: true,
          lastSeen: Math.floor(Date.now() / 1000)
        });
      }
    }

    // 2. Mark any un-delivered messages addressed to this newly connected user as DELIVERED
    const deliveredIds = await messageRepo.markBatchAsDelivered(userId);
    if (deliveredIds && deliveredIds.length > 0 && peer && activeUserSockets.has(peer.id)) {
      for (const peerSocketId of activeUserSockets.get(peer.id)) {
        io.to(peerSocketId).emit('messages:batch_status_update', {
          messageIds: deliveredIds,
          status: 'delivered',
          deliveredAt: Math.floor(Date.now() / 1000)
        });
      }
    }

    console.log(`🔌 [Socket] User ${user.username} (ID: ${userId}) connected. Socket: ${socket.id}`);

    // 3. Handle message sending
    socket.on('message:send', async (data, callback) => {
      try {
        const currentPeer = await userRepo.getPeer(userId);
        if (!currentPeer) {
          if (callback) callback({ success: false, error: 'No peer registered yet.' });
          return;
        }

        const peerId = currentPeer.id;
        const isPeerConnected = activeUserSockets.has(peerId) && activeUserSockets.get(peerId).size > 0;
        const initialStatus = isPeerConnected ? 'delivered' : 'sent';
        const now = Math.floor(Date.now() / 1000);

        const newMsg = await messageRepo.create({
          id: data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          senderId: userId,
          recipientId: peerId,
          content: data.content,
          isEncrypted: data.isEncrypted ? 1 : 0,
          encryptionMeta: data.encryptionMeta,
          type: data.type || 'text',
          mediaUrl: data.mediaUrl || null,
          mediaMeta: data.mediaMeta || null,
          status: initialStatus,
          createdAt: data.createdAt ? Math.floor(data.createdAt / 1000) : now
        });

        // If delivered immediately, update deliveredAt
        if (initialStatus === 'delivered') {
          await messageRepo.updateStatus(newMsg.id, 'delivered', now);
          newMsg.deliveredAt = now;
        }

        // Acknowledge back to sender
        if (callback) {
          callback({ success: true, message: newMsg });
        }

        // Forward to recipient sockets
        if (isPeerConnected) {
          for (const peerSocketId of activeUserSockets.get(peerId)) {
            io.to(peerSocketId).emit('message:receive', newMsg);
          }
        }
      } catch (err) {
        console.error('Socket message:send error:', err);
        if (callback) callback({ success: false, error: 'Failed to process message' });
      }
    });

    // 4. Handle Read Receipts (Double Blue Ticks)
    socket.on('messages:read', async ({ senderId, messageIds }) => {
      try {
        const readAt = Math.floor(Date.now() / 1000);
        let updatedIds = [];

        if (messageIds && messageIds.length > 0) {
          for (const id of messageIds) {
            await messageRepo.updateStatus(id, 'read', readAt);
          }
          updatedIds = messageIds;
        } else if (senderId) {
          updatedIds = await messageRepo.markBatchAsRead(userId, senderId, readAt);
        }

        if (updatedIds.length > 0 && activeUserSockets.has(senderId)) {
          for (const senderSocketId of activeUserSockets.get(senderId)) {
            io.to(senderSocketId).emit('messages:batch_status_update', {
              messageIds: updatedIds,
              status: 'read',
              readAt
            });
          }
        }
      } catch (err) {
        console.error('Socket messages:read error:', err);
      }
    });

    // 5. Handle Typing Indicators
    socket.on('typing:start', async () => {
      const currentPeer = await userRepo.getPeer(userId);
      if (currentPeer && activeUserSockets.has(currentPeer.id)) {
        for (const peerSocketId of activeUserSockets.get(currentPeer.id)) {
          io.to(peerSocketId).emit('typing:indicator', {
            userId,
            isTyping: true
          });
        }
      }
    });

    socket.on('typing:stop', async () => {
      const currentPeer = await userRepo.getPeer(userId);
      if (currentPeer && activeUserSockets.has(currentPeer.id)) {
        for (const peerSocketId of activeUserSockets.get(currentPeer.id)) {
          io.to(peerSocketId).emit('typing:indicator', {
            userId,
            isTyping: false
          });
        }
      }
    });

    // 6. Handle Delete for Everyone
    socket.on('message:delete_everyone', async ({ messageId }) => {
      try {
        const msg = await messageRepo.findById(messageId);
        if (msg && msg.senderId === userId) {
          await messageRepo.deleteForEveryone(messageId, userId);
          const currentPeer = await userRepo.getPeer(userId);
          if (currentPeer && activeUserSockets.has(currentPeer.id)) {
            for (const peerSocketId of activeUserSockets.get(currentPeer.id)) {
              io.to(peerSocketId).emit('message:deleted', { messageId });
            }
          }
        }
      } catch (err) {
        console.error('Socket message:delete_everyone error:', err);
      }
    });

    // 7. Handle Disconnection
    socket.on('disconnect', async () => {
      console.log(`❌ [Socket] User ${user.username} socket ${socket.id} disconnected.`);
      const userSockets = activeUserSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          activeUserSockets.delete(userId);
          const lastSeen = Math.floor(Date.now() / 1000);
          await userRepo.updateOnlineStatus(userId, 0, lastSeen);

          const currentPeer = await userRepo.getPeer(userId);
          if (currentPeer && activeUserSockets.has(currentPeer.id)) {
            for (const peerSocketId of activeUserSockets.get(currentPeer.id)) {
              io.to(peerSocketId).emit('presence:status', {
                userId,
                isOnline: false,
                lastSeen
              });
            }
          }
        }
      }
    });
  });
};

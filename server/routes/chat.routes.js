import express from 'express';
import { messageRepo, userRepo } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMedia } from '../middleware/upload.js';
import { apiLimiter, uploadLimiter } from '../config/security.js';

const router = express.Router();

// Apply auth middleware to all chat routes
router.use(requireAuth);

/**
 * @route GET /api/chat/messages
 * @desc Get chronological message history for the 1-on-1 chat
 */
router.get('/messages', apiLimiter, async (req, res) => {
  try {
    const peer = await userRepo.getPeer(req.user.id);
    if (!peer) {
      return res.json({
        success: true,
        data: {
          messages: [],
          peer: null
        }
      });
    }

    const { q, limit, before } = req.query;

    // Search query
    if (q && q.trim().length > 0) {
      const results = await messageRepo.search({
        userId: req.user.id,
        peerId: peer.id,
        query: q.trim()
      });
      return res.json({
        success: true,
        data: {
          messages: results,
          peer
        }
      });
    }

    // Standard history
    const parsedLimit = Math.min(parseInt(limit, 10) || 100, 200);
    const beforeTimestamp = before ? parseInt(before, 10) : null;

    const messages = await messageRepo.getHistory({
      userId: req.user.id,
      peerId: peer.id,
      limit: parsedLimit,
      beforeTimestamp
    });

    return res.json({
      success: true,
      data: {
        messages,
        peer
      }
    });
  } catch (err) {
    console.error('Fetch Messages Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve message history.'
    });
  }
});

/**
 * @route POST /api/chat/upload
 * @desc Securely upload rich media (images and voice notes)
 */
router.post('/upload', uploadLimiter, uploadMedia.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded or file type rejected.'
      });
    }

    const isImage = req.file.mimetype.startsWith('image/');
    const isAudio = req.file.mimetype.startsWith('audio/');

    const mediaUrl = `/uploads/${req.file.filename}`;
    const mediaMeta = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      duration: req.body.duration ? parseFloat(req.body.duration) : null
    };

    return res.json({
      success: true,
      data: {
        mediaUrl,
        type: isImage ? 'image' : (isAudio ? 'audio' : 'file'),
        mediaMeta
      }
    });
  } catch (err) {
    console.error('Media Upload Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'File upload failed.'
    });
  }
});

/**
 * @route DELETE /api/chat/messages/:id
 * @desc Delete message (for everyone or for me)
 */
router.delete('/messages/:id', apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { mode } = req.query; // 'everyone' or 'me'

    const message = await messageRepo.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.'
      });
    }

    if (mode === 'everyone') {
      if (message.senderId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own messages for everyone.'
        });
      }
      await messageRepo.deleteForEveryone(id, req.user.id);
    } else {
      await messageRepo.deleteForUser(id, req.user.id);
    }

    return res.json({
      success: true,
      message: 'Message deleted successfully.'
    });
  } catch (err) {
    console.error('Delete Message Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete message.'
    });
  }
});

export default router;

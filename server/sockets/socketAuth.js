import jwt from 'jsonwebtoken';
import { userRepo } from '../database/db.js';

/**
 * Socket.io Handshake Authentication Middleware
 * Validates JWT from HTTP-only cookie or socket auth token
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    let token = null;

    // 1. Check handshake auth token
    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    }

    // 2. Fallback to handshake cookie header
    if (!token && socket.handshake.headers.cookie) {
      const match = socket.handshake.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (!token) {
      return next(new Error('Authentication error: No session token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userRepo.findById(decoded.id);

    if (!user) {
      return next(new Error('Authentication error: User account does not exist'));
    }

    socket.user = user;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid or expired token'));
  }
};

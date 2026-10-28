import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

// Configurations & Database
import { initDatabase } from './database/db.js';
import { configureHelmet, enforceHttps, getCorsOptions } from './config/security.js';
import { requireAuth } from './middleware/auth.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';

// Sockets
import { socketAuthMiddleware } from './sockets/socketAuth.js';
import { setupChatSocketHandlers } from './sockets/chatHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// 1. Initialize Database & Tables (PostgreSQL if DATABASE_URL configured, otherwise SQLite)
await initDatabase();

// 2. Setup Socket.io Server
const io = new Server(server, {
  cors: getCorsOptions(),
  pingTimeout: 30000,
  pingInterval: 15000,
  cookie: true
});

// Socket.io Handshake Auth & Handlers
io.use(socketAuthMiddleware);
setupChatSocketHandlers(io);

// 3. Security & Standard Middlewares
app.use(enforceHttps);
app.use(configureHelmet());
app.use(cors(getCorsOptions()));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Protected Static Uploads Route (Requires authentication to view images/voice notes)
app.use('/uploads', requireAuth, express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  immutable: true
}));

// 5. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0-production'
  });
});

// Serve frontend static build if present (production or pre-built dist)
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = parseInt(process.env.PORT, 10) || 5000;

server.listen(PORT, () => {
  console.log(`
=====================================================
🛡️  PRIVATE 1-ON-1 SECURE MESSAGING SERVER ACTIVE
=====================================================
📡  Port:          ${PORT}
🔒  Mode:          ${process.env.NODE_ENV || 'development'}
👥  User Limit:    2 users strictly enforced
🔑  Auth:          JWT + HTTP-Only Secure Cookies
🔐  Encryption:    Client-Side AES-256-GCM Compatible
🚀  Ready at:      http://localhost:${PORT}
=====================================================
  `);
});

// Graceful process termination
const handleGracefulShutdown = () => {
  console.log('Shutting down server safely...');
  server.close(() => {
    console.log('HTTP & Socket server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', handleGracefulShutdown);
process.on('SIGINT', handleGracefulShutdown);

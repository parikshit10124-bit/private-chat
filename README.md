# 🛡️ Private 1-on-1 Secure Messaging Web Application

> An exclusive, production-ready, zero-knowledge private messaging instance designed exclusively for two participants, inspired by WhatsApp and Signal.

---

## 📋 Architectural Overview

The application is built with strict isolation to ensure absolute privacy between two designated participants. Outsiders cannot register or join after both seats are claimed.

```
shit/
├── client/                     # Frontend (React 19, Vite, Tailwind CSS)
│   ├── public/                 # Static assets & SVG favicon
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/           # Login & Register views with 2-seat limit display
│   │   │   ├── Chat/           # MessageBubble, MessageInput, VoiceRecorder, Sidebar
│   │   │   ├── Security/       # AutoLockOverlay, EncryptionModal, SafetyBadge
│   │   │   └── UI/             # ThemeToggle, SearchBar
│   │   ├── context/            # AuthContext, SocketContext, ChatContext, SecurityContext
│   │   ├── utils/              # Web Crypto AES-256-GCM, date formatters, audio helpers
│   │   ├── App.jsx             # Main application layout and view controller
│   │   ├── index.css           # Tailwind directives, custom scrollbars, wallpaper patterns
│   │   └── main.jsx            # React root mount
│   ├── index.html
│   ├── tailwind.config.js      # WhatsApp/Signal authentic dark & light theme tokens
│   ├── vite.config.js          # Vite config with /api and /socket.io reverse proxies
│   └── package.json
├── server/                     # Backend (Node.js, Express, Socket.io, SQLite WAL)
│   ├── config/
│   │   └── security.js         # Helmet CSP, HSTS, rate-limiting, strict CORS
│   ├── database/
│   │   ├── db.js               # Synchronous WAL-mode SQLite repository (node:sqlite)
│   │   └── mongoSchema.js      # Reference Mongoose schemas for MongoDB alternative
│   ├── middleware/
│   │   ├── auth.js             # JWT extraction from HTTP-Only cookie & fallback header
│   │   └── upload.js           # Multer media handler for images and voice notes
│   ├── routes/
│   │   ├── auth.routes.js      # 2-Seat gated auth, invite codes, quick unlock PIN
│   │   └── chat.routes.js      # Message history, search, upload, message deletion
│   ├── sockets/
│   │   ├── socketAuth.js       # Handshake JWT authentication
│   │   └── chatHandler.js      # Real-time messaging, presence, typing, delivery/read ticks
│   ├── uploads/                # Protected directory for encrypted/uploaded media
│   ├── .env.example            # Sample server environment configuration
│   ├── package.json
│   └── server.js               # Server bootstrap & WebSocket initializer
├── package.json                # Root convenience scripts
└── README.md                   # Comprehensive documentation & deployment guide
```

---

## 🔒 Security Architecture

### 1. Two-User Hard Isolation
- **Seat Quota**: At the database level, registrations are counted (`SELECT COUNT(*) FROM users`). When 2 users exist, all registration attempts immediately fail with `403 Forbidden: Private Instance Full`.
- **First User (Admin/Host)**: The first user creates the instance. Upon creation, an exclusive single-use invite code is cryptographically generated for User 2.
- **Second User (Invited Peer)**: User 2 must provide the invite code or register via the host's invite URL (`?invite=<code>`).
- **Permanent Lock**: Once User 2 registers, the gate is permanently sealed.

### 2. End-to-End Client-Side Message Encryption (AES-GCM 256-bit)
- Built entirely on the browser's native **Web Crypto API** (`window.crypto.subtle`).
- **Key Derivation**: Key derived using `PBKDF2` with `SHA-256` and **100,000 iterations** from a shared pre-shared secret passphrase.
- **Payload Security**: Each message generates a fresh 16-byte random salt and 12-byte initialization vector (IV).
- **Server Zero-Knowledge**: The server database only stores `{ ciphertext, iv, salt, version }`. Even if the database is leaked or inspected by a host administrator, message contents cannot be read without the user's secret passphrase.
- **Safety Numbers**: A Signal-style safety fingerprint (6 blocks of 5 digits) is derived from the key hash so peers can verify key parity out-of-band.

### 3. Authentication & Session Defense
- **JWT in HTTP-Only Cookies**: Tokens are stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies, blocking XSS token theft.
- **Password Security**: Passwords are salted and hashed using `bcrypt` (work factor 12).
- **Brute-Force Protection**: Express rate limiting restricts authentication endpoints to 20 attempts per 15 minutes per IP.
- **Protected Media Endpoint**: The `/uploads` route requires an active authenticated session; unauthorized public web scraping of uploaded photos or audio notes is blocked.

### 4. Inactivity Auto-Lock & Privacy Camouflage
- **Idle Timeout**: Monitored via user interactions (`mousemove`, `keydown`, `touchstart`). If idle exceeds the configured time (1, 2, 5, 15 minutes), the chat blurs behind a frosted-glass overlay (`backdrop-blur-xl`).
- **Quick Unlock**: Users can unlock the screen with a configured 4–8 digit PIN or their account password.
- **Camouflage on Tab Switch**: Optional setting that immediately locks and blurs the screen whenever the browser tab loses focus (`visibilitychange`).

---

## ⚡ Real-Time WebSocket Messaging (Socket.io)

### Delivery & Read Receipts (WhatsApp/Signal Ticks)
- **Single Grey Tick (`✓`)**: Message stored in database (`status: 'sent'`).
- **Double Grey Ticks (`✓✓`)**: Recipient socket is connected and confirmed delivery (`status: 'delivered'`).
- **Double Blue Ticks (`✓✓` in `#53bdeb`)**: Recipient has the chat open and focused (`status: 'read'`).
- **Batch Catch-Up**: When a peer comes online, all pending sent messages are immediately marked delivered and the sender receives a `messages:batch_status_update` event.

### Real-Time Presence & Typing Indicators
- Real-time online/offline indicators with exact "last seen" timestamps.
- Typing indicator (`...is typing`) with automated 2-second debounce and auto-cleanup.

### Rich Media & Audio Voice Notes
- **Voice Notes**: Uses browser `MediaRecorder` API with a live recording counter, animated pulsating waveform, cancel/discard, and instant preview.
- **Custom Player**: Sleek inline audio player in the message bubble with scrub progress bar and duration.
- **Image Sharing**: File selection preview, auto-upload, and full-screen lightbox modal with zoom and download.

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js v20+ or v22+ (Node.js 24 has native SQLite support built-in!)
- npm

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd <project-folder>

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables
Inside `server/`, create `.env` (or copy from `.env.example`):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
JWT_SECRET=generate_a_secure_random_base64_secret_key_32_bytes
JWT_EXPIRES_IN=7d
MAX_USERS_ALLOWED=2
INVITE_CODE=
MAX_FILE_SIZE_MB=10
```

### 3. Start Development Servers
Open two terminal windows:

**Terminal 1 (Backend Server):**
```bash
cd server
npm run dev
# Server active at http://localhost:5000
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
# Frontend active at http://localhost:3000
```

Open your browser to `http://localhost:3000`.

---

## 🚢 Production Deployment Guide

### Option A: Single-Host VPS (DigitalOcean / AWS EC2 / Linode / Hetzner)

This is the recommended deployment strategy for maximum privacy and zero third-party platform sniffing.

1. **Build the Frontend**:
   ```bash
   cd client
   npm run build
   # Generates client/dist
   ```

2. **Server Configuration**:
   In production (`NODE_ENV=production`), `server/server.js` automatically serves the compiled `client/dist` bundle and enforces HTTPS.

3. **Run with PM2 (Process Manager)**:
   ```bash
   npm install -g pm2
   cd server
   pm2 start server.js --name "private-messenger"
   pm2 startup
   pm2 save
   ```

4. **Nginx Reverse Proxy with SSL (Certbot Let's Encrypt)**:
   Create `/etc/nginx/sites-available/chat.yourdomain.com`:
   ```nginx
   server {
       server_name chat.yourdomain.com;

       # Enforce file upload size
       client_max_body_size 15M;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;

           # WebSocket Support (WSS)
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";

           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Enable SSL:
   ```bash
   sudo certbot --nginx -d chat.yourdomain.com
   sudo systemctl reload nginx
   ```

### Option B: Platform Deployment (Render / Railway)

1. Set Root Directory to repository root or `server`.
2. Build Command:
   ```bash
   cd client && npm install && npm run build && cd ../server && npm install
   ```
3. Start Command:
   ```bash
   cd server && node server.js
   ```
4. Set Environment Variables:
   - `NODE_ENV=production`
   - `PORT=5000` (or platform `$PORT`)
   - `JWT_SECRET=<random_secret>`

### Option C: Frontend on Vercel + Backend on Render/Railway/VPS (Decoupled)

Because real-time messaging relies on persistent WebSockets (`socket.io`), the backend requires a stateful Node.js host (like Render, Railway, Fly.io, or VPS), while the React frontend deploys smoothly on Vercel's global Edge CDN:

1. **Deploy Backend First** (e.g. on [Render](https://render.com) or [Railway](https://railway.app)):
   - Deploy `server/` with `npm install` and `npm start`.
   - Copy your public backend URL (e.g., `https://your-backend.onrender.com`).

2. **Deploy Frontend on Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and import this repository (`private-chat`).
   - Root Directory: Works with default `./` (or optionally set to `client`).
   - In **Environment Variables**, add:
     - `VITE_SERVER_URL`: `https://your-backend.onrender.com` (your backend URL without trailing slash).
   - Click **Deploy**. Vercel will build the Vite app and serve it with automatic SPA rewrites (`vercel.json`).

---

## 🧪 Verification & Health Check

You can verify the backend health and uptime anytime:
```bash
curl http://localhost:5000/api/health
```
Expected response:
```json
{
  "status": "online",
  "timestamp": "2026-10-25T19:13:21.251Z",
  "uptime": 81.11,
  "version": "1.0.0-production"
}
```

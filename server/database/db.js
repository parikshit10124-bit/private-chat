import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  initPostgresDatabase,
  pgUserRepo,
  pgInviteRepo,
  pgMessageRepo
} from './postgres.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect whether PostgreSQL is enabled
export const isPostgresEnabled = () => {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DB_TYPE === 'postgres'
  );
};

let activeDbEngine = 'sqlite';

// SQLite fallback initialization
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'private_chat.db');
let sqliteDb = null;

function getSqliteDb() {
  if (!sqliteDb) {
    sqliteDb = new DatabaseSync(dbPath);
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
    sqliteDb.exec('PRAGMA synchronous = NORMAL;');
  }
  return sqliteDb;
}

// Master Schema Initializer
export async function initDatabase() {
  if (isPostgresEnabled()) {
    try {
      console.log('🔄 Attempting connection to PostgreSQL database...');
      await initPostgresDatabase();
      activeDbEngine = 'postgres';
      console.log('🐘 Active Database Engine: PostgreSQL / Supabase');
      return 'postgres';
    } catch (err) {
      console.error('⚠️ PostgreSQL Connection Error:', err.message);
      console.log('🔄 Falling back to zero-config SQLite database to keep application running.');
      activeDbEngine = 'sqlite';
    }
  }

  // SQLite Schema Setup
  const db = getSqliteDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      displayName TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      avatar TEXT,
      role TEXT DEFAULT 'member',
      pinHash TEXT,
      isOnline INTEGER DEFAULT 0,
      lastSeen INTEGER DEFAULT (strftime('%s', 'now')),
      createdAt INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      createdBy INTEGER NOT NULL,
      isUsed INTEGER DEFAULT 0,
      usedBy INTEGER,
      createdAt INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (usedBy) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      senderId INTEGER NOT NULL,
      recipientId INTEGER NOT NULL,
      content TEXT NOT NULL,
      isEncrypted INTEGER DEFAULT 0,
      encryptionMeta TEXT,
      type TEXT DEFAULT 'text',
      mediaUrl TEXT,
      mediaMeta TEXT,
      status TEXT DEFAULT 'sent',
      deliveredAt INTEGER,
      readAt INTEGER,
      deletedForSender INTEGER DEFAULT 0,
      deletedForRecipient INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipientId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (senderId, recipientId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_messages_status ON messages (recipientId, status);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (createdAt);
  `);

  activeDbEngine = 'sqlite';
  console.log('✅ SQLite Database initialized with WAL mode.');
  return 'sqlite';
}

export function getActiveDbEngine() {
  return activeDbEngine;
}

// Internal SQLite Repository Implementations
const sqliteUserRepo = {
  count() {
    const row = getSqliteDb().prepare('SELECT COUNT(*) as count FROM users').get();
    return row ? Number(row.count) : 0;
  },

  findById(id) {
    return getSqliteDb().prepare('SELECT id, username, displayName, avatar, role, isOnline, lastSeen, createdAt FROM users WHERE id = ?').get(id);
  },

  findByUsername(username) {
    return getSqliteDb().prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
  },

  create({ username, displayName, passwordHash, avatar, role = 'member' }) {
    const stmt = getSqliteDb().prepare(`
      INSERT INTO users (username, displayName, passwordHash, avatar, role, createdAt)
      VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
    `);
    const result = stmt.run(username, displayName, passwordHash, avatar || null, role);
    return this.findById(result.lastInsertRowid);
  },

  updateOnlineStatus(id, isOnline, lastSeen = Math.floor(Date.now() / 1000)) {
    getSqliteDb().prepare('UPDATE users SET isOnline = ?, lastSeen = ? WHERE id = ?').run(isOnline ? 1 : 0, lastSeen, id);
  },

  setPin(id, pinHash) {
    getSqliteDb().prepare('UPDATE users SET pinHash = ? WHERE id = ?').run(pinHash, id);
  },

  getPin(id) {
    const row = getSqliteDb().prepare('SELECT pinHash FROM users WHERE id = ?').get(id);
    return row ? row.pinHash : null;
  },

  getAllMembers() {
    return getSqliteDb().prepare('SELECT id, username, displayName, avatar, role, isOnline, lastSeen, createdAt FROM users').all();
  },

  getPeer(currentUserId) {
    return getSqliteDb().prepare('SELECT id, username, displayName, avatar, role, isOnline, lastSeen, createdAt FROM users WHERE id != ? LIMIT 1').get(currentUserId);
  }
};

const sqliteInviteRepo = {
  create(code, createdBy) {
    getSqliteDb().prepare("INSERT INTO invites (code, createdBy, createdAt) VALUES (?, ?, strftime('%s', 'now'))").run(code, createdBy);
    return this.findByCode(code);
  },

  findByCode(code) {
    return getSqliteDb().prepare('SELECT * FROM invites WHERE code = ?').get(code);
  },

  findActive() {
    return getSqliteDb().prepare('SELECT * FROM invites WHERE isUsed = 0 ORDER BY id DESC LIMIT 1').get();
  },

  markUsed(code, usedBy) {
    getSqliteDb().prepare('UPDATE invites SET isUsed = 1, usedBy = ? WHERE code = ?').run(usedBy, code);
  }
};

const sqliteMessageRepo = {
  create({
    id,
    senderId,
    recipientId,
    content,
    isEncrypted = 0,
    encryptionMeta = null,
    type = 'text',
    mediaUrl = null,
    mediaMeta = null,
    status = 'sent',
    createdAt = Math.floor(Date.now() / 1000)
  }) {
    const stmt = getSqliteDb().prepare(`
      INSERT INTO messages (
        id, senderId, recipientId, content, isEncrypted, encryptionMeta,
        type, mediaUrl, mediaMeta, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      senderId,
      recipientId,
      content,
      isEncrypted ? 1 : 0,
      encryptionMeta ? (typeof encryptionMeta === 'string' ? encryptionMeta : JSON.stringify(encryptionMeta)) : null,
      type,
      mediaUrl,
      mediaMeta ? (typeof mediaMeta === 'string' ? mediaMeta : JSON.stringify(mediaMeta)) : null,
      status,
      createdAt
    );
    return this.findById(id);
  },

  findById(id) {
    const row = getSqliteDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!row) return null;
    return this._formatMessage(row);
  },

  getHistory({ userId, peerId, limit = 100, beforeTimestamp = null }) {
    let query = `
      SELECT * FROM messages
      WHERE ((senderId = ? AND recipientId = ? AND deletedForSender = 0)
         OR (senderId = ? AND recipientId = ? AND deletedForRecipient = 0))
    `;
    const params = [userId, peerId, peerId, userId];

    if (beforeTimestamp) {
      query += ` AND createdAt < ?`;
      params.push(beforeTimestamp);
    }

    query += ` ORDER BY createdAt ASC LIMIT ?`;
    params.push(limit);

    const rows = getSqliteDb().prepare(query).all(...params);
    return rows.map(r => this._formatMessage(r));
  },

  search({ userId, peerId, query }) {
    const sql = `
      SELECT * FROM messages
      WHERE ((senderId = ? AND recipientId = ? AND deletedForSender = 0)
         OR (senderId = ? AND recipientId = ? AND deletedForRecipient = 0))
        AND content LIKE ?
      ORDER BY createdAt DESC LIMIT 50
    `;
    const rows = getSqliteDb().prepare(sql).all(userId, peerId, peerId, userId, `%${query}%`);
    return rows.map(r => this._formatMessage(r));
  },

  updateStatus(id, status, timestamp = Math.floor(Date.now() / 1000)) {
    if (status === 'delivered') {
      getSqliteDb().prepare(`
        UPDATE messages 
        SET status = 'delivered', deliveredAt = COALESCE(deliveredAt, ?) 
        WHERE id = ? AND status = 'sent'
      `).run(timestamp, id);
    } else if (status === 'read') {
      getSqliteDb().prepare(`
        UPDATE messages 
        SET status = 'read', 
            deliveredAt = COALESCE(deliveredAt, ?),
            readAt = ? 
        WHERE id = ?
      `).run(timestamp, timestamp, id);
    }
  },

  markBatchAsDelivered(recipientId, timestamp = Math.floor(Date.now() / 1000)) {
    const rows = getSqliteDb().prepare(`
      SELECT id FROM messages 
      WHERE recipientId = ? AND status = 'sent'
    `).all(recipientId);

    if (rows.length > 0) {
      getSqliteDb().prepare(`
        UPDATE messages 
        SET status = 'delivered', deliveredAt = ? 
        WHERE recipientId = ? AND status = 'sent'
      `).run(timestamp, recipientId);
    }
    return rows.map(r => r.id);
  },

  markBatchAsRead(recipientId, senderId, timestamp = Math.floor(Date.now() / 1000)) {
    const rows = getSqliteDb().prepare(`
      SELECT id FROM messages 
      WHERE recipientId = ? AND senderId = ? AND status != 'read'
    `).all(recipientId, senderId);

    if (rows.length > 0) {
      getSqliteDb().prepare(`
        UPDATE messages 
        SET status = 'read', 
            deliveredAt = COALESCE(deliveredAt, ?),
            readAt = ? 
        WHERE recipientId = ? AND senderId = ? AND status != 'read'
      `).run(timestamp, timestamp, recipientId, senderId);
    }
    return rows.map(r => r.id);
  },

  deleteForUser(messageId, userId) {
    const msg = getSqliteDb().prepare('SELECT senderId, recipientId FROM messages WHERE id = ?').get(messageId);
    if (!msg) return false;

    if (msg.senderId === userId) {
      getSqliteDb().prepare('UPDATE messages SET deletedForSender = 1 WHERE id = ?').run(messageId);
    } else if (msg.recipientId === userId) {
      getSqliteDb().prepare('UPDATE messages SET deletedForRecipient = 1 WHERE id = ?').run(messageId);
    }
    return true;
  },

  deleteForEveryone(messageId, senderId) {
    const stmt = getSqliteDb().prepare('DELETE FROM messages WHERE id = ? AND senderId = ?');
    const res = stmt.run(messageId, senderId);
    return res.changes > 0;
  },

  _formatMessage(row) {
    return {
      ...row,
      isEncrypted: Boolean(row.isEncrypted),
      deletedForSender: Boolean(row.deletedForSender),
      deletedForRecipient: Boolean(row.deletedForRecipient),
      encryptionMeta: row.encryptionMeta ? (typeof row.encryptionMeta === 'string' ? JSON.parse(row.encryptionMeta) : row.encryptionMeta) : null,
      mediaMeta: row.mediaMeta ? (typeof row.mediaMeta === 'string' ? JSON.parse(row.mediaMeta) : row.mediaMeta) : null,
    };
  }
};

// Unified Exported Repositories (Dispatches to PostgreSQL if active, or SQLite)
export const userRepo = {
  async count() {
    return activeDbEngine === 'postgres' ? await pgUserRepo.count() : sqliteUserRepo.count();
  },
  async findById(id) {
    return activeDbEngine === 'postgres' ? await pgUserRepo.findById(id) : sqliteUserRepo.findById(id);
  },
  async findByUsername(username) {
    return activeDbEngine === 'postgres' ? await pgUserRepo.findByUsername(username) : sqliteUserRepo.findByUsername(username);
  },
  async create(data) {
    return activeDbEngine === 'postgres' ? await pgUserRepo.create(data) : sqliteUserRepo.create(data);
  },
  async updateOnlineStatus(id, isOnline, lastSeen) {
    return activeDbEngine === 'postgres'
      ? await pgUserRepo.updateOnlineStatus(id, isOnline, lastSeen)
      : sqliteUserRepo.updateOnlineStatus(id, isOnline, lastSeen);
  },
  async setPin(id, pinHash) {
    return activeDbEngine === 'postgres' ? await pgUserRepo.setPin(id, pinHash) : sqliteUserRepo.setPin(id, pinHash);
  },
  async getPin(id) {
    return activeDbEngine === 'postgres' ? await pgUserRepo.getPin(id) : sqliteUserRepo.getPin(id);
  },
  async getAllMembers() {
    return activeDbEngine === 'postgres' ? await pgUserRepo.getAllMembers() : sqliteUserRepo.getAllMembers();
  },
  async getPeer(currentUserId) {
    return activeDbEngine === 'postgres' ? await pgUserRepo.getPeer(currentUserId) : sqliteUserRepo.getPeer(currentUserId);
  }
};

export const inviteRepo = {
  async create(code, createdBy) {
    return activeDbEngine === 'postgres' ? await pgInviteRepo.create(code, createdBy) : sqliteInviteRepo.create(code, createdBy);
  },
  async findByCode(code) {
    return activeDbEngine === 'postgres' ? await pgInviteRepo.findByCode(code) : sqliteInviteRepo.findByCode(code);
  },
  async findActive() {
    return activeDbEngine === 'postgres' ? await pgInviteRepo.findActive() : sqliteInviteRepo.findActive();
  },
  async markUsed(code, usedBy) {
    return activeDbEngine === 'postgres' ? await pgInviteRepo.markUsed(code, usedBy) : sqliteInviteRepo.markUsed(code, usedBy);
  }
};

export const messageRepo = {
  async create(data) {
    return activeDbEngine === 'postgres' ? await pgMessageRepo.create(data) : sqliteMessageRepo.create(data);
  },
  async findById(id) {
    return activeDbEngine === 'postgres' ? await pgMessageRepo.findById(id) : sqliteMessageRepo.findById(id);
  },
  async getHistory(params) {
    return activeDbEngine === 'postgres' ? await pgMessageRepo.getHistory(params) : sqliteMessageRepo.getHistory(params);
  },
  async search(params) {
    return activeDbEngine === 'postgres' ? await pgMessageRepo.search(params) : sqliteMessageRepo.search(params);
  },
  async updateStatus(id, status, timestamp) {
    return activeDbEngine === 'postgres'
      ? await pgMessageRepo.updateStatus(id, status, timestamp)
      : sqliteMessageRepo.updateStatus(id, status, timestamp);
  },
  async markBatchAsDelivered(recipientId, timestamp) {
    return activeDbEngine === 'postgres'
      ? await pgMessageRepo.markBatchAsDelivered(recipientId, timestamp)
      : sqliteMessageRepo.markBatchAsDelivered(recipientId, timestamp);
  },
  async markBatchAsRead(recipientId, senderId, timestamp) {
    return activeDbEngine === 'postgres'
      ? await pgMessageRepo.markBatchAsRead(recipientId, senderId, timestamp)
      : sqliteMessageRepo.markBatchAsRead(recipientId, senderId, timestamp);
  },
  async deleteForUser(messageId, userId) {
    return activeDbEngine === 'postgres'
      ? await pgMessageRepo.deleteForUser(messageId, userId)
      : sqliteMessageRepo.deleteForUser(messageId, userId);
  },
  async deleteForEveryone(messageId, senderId) {
    return activeDbEngine === 'postgres'
      ? await pgMessageRepo.deleteForEveryone(messageId, senderId)
      : sqliteMessageRepo.deleteForEveryone(messageId, senderId);
  }
};

export default { userRepo, inviteRepo, messageRepo };

import pg from 'pg';

const { Pool } = pg;

let pool = null;

export function getPostgresPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  let poolConfig = {};

  if (connectionString) {
    poolConfig = {
      connectionString,
      // Automatic SSL config for cloud providers like Supabase, Neon, Render, etc.
      ssl: process.env.PGSSL === 'true' || connectionString.includes('sslmode=require') || connectionString.includes('supabase') || connectionString.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : false
    };
  } else {
    // Individual credentials (default local postgres)
    poolConfig = {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT, 10) || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'private_chat',
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
    };
  }

  pool = new Pool({
    ...poolConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });

  return pool;
}

/**
 * Initialize PostgreSQL Schema
 */
export async function initPostgresDatabase() {
  const p = getPostgresPool();
  const client = await p.connect();

  try {
    await client.query('BEGIN');

    // Users table (strictly capped at 2 registered users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        password_hash TEXT NOT NULL,
        avatar TEXT,
        role VARCHAR(20) DEFAULT 'member',
        pin_hash TEXT,
        is_online BOOLEAN DEFAULT false,
        last_seen BIGINT DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS BIGINT),
        created_at BIGINT DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS BIGINT)
      );
    `);

    // Invites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invites (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_used BOOLEAN DEFAULT false,
        used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at BIGINT DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS BIGINT)
      );
    `);

    // 1-on-1 Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(100) PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_encrypted BOOLEAN DEFAULT false,
        encryption_meta JSONB,
        type VARCHAR(30) DEFAULT 'text',
        media_url TEXT,
        media_meta JSONB,
        status VARCHAR(20) DEFAULT 'sent',
        delivered_at BIGINT,
        read_at BIGINT,
        deleted_for_sender BOOLEAN DEFAULT false,
        deleted_for_recipient BOOLEAN DEFAULT false,
        created_at BIGINT DEFAULT CAST(EXTRACT(EPOCH FROM NOW()) AS BIGINT)
      );
    `);

    // Indexes for fast querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pg_messages_conversation ON messages (sender_id, recipient_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_pg_messages_status ON messages (recipient_id, status);
      CREATE INDEX IF NOT EXISTS idx_pg_messages_created ON messages (created_at);
    `);

    await client.query('COMMIT');
    console.log('✅ PostgreSQL Database connected & schemas initialized successfully.');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const formatPgUser = (row, includeSecrets = false) => {
  if (!row) return null;
  const user = {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar,
    role: row.role,
    isOnline: Boolean(row.is_online),
    lastSeen: Number(row.last_seen),
    createdAt: Number(row.created_at)
  };
  if (includeSecrets) {
    user.passwordHash = row.password_hash;
    user.pinHash = row.pin_hash;
  }
  return user;
};

const formatPgMessage = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    content: row.content,
    isEncrypted: Boolean(row.is_encrypted),
    encryptionMeta: row.encryption_meta || null,
    type: row.type,
    mediaUrl: row.media_url,
    mediaMeta: row.media_meta || null,
    status: row.status,
    deliveredAt: row.delivered_at ? Number(row.delivered_at) : null,
    readAt: row.read_at ? Number(row.read_at) : null,
    deletedForSender: Boolean(row.deleted_for_sender),
    deletedForRecipient: Boolean(row.deleted_for_recipient),
    createdAt: Number(row.created_at)
  };
};

// PostgreSQL User Repository
export const pgUserRepo = {
  async count() {
    const res = await getPostgresPool().query('SELECT COUNT(*) as count FROM users');
    return parseInt(res.rows[0].count, 10);
  },

  async findById(id) {
    const res = await getPostgresPool().query('SELECT * FROM users WHERE id = $1', [id]);
    return formatPgUser(res.rows[0]);
  },

  async findByUsername(username) {
    const res = await getPostgresPool().query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    return formatPgUser(res.rows[0], true);
  },

  async create({ username, displayName, passwordHash, avatar, role = 'member' }) {
    const now = Math.floor(Date.now() / 1000);
    const res = await getPostgresPool().query(
      `INSERT INTO users (username, display_name, password_hash, avatar, role, created_at, last_seen)
       VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING *`,
      [username.toLowerCase().trim(), displayName.trim(), passwordHash, avatar, role, now]
    );
    return formatPgUser(res.rows[0]);
  },

  async updateOnlineStatus(id, isOnline, lastSeen = Math.floor(Date.now() / 1000)) {
    await getPostgresPool().query(
      'UPDATE users SET is_online = $1, last_seen = $2 WHERE id = $3',
      [isOnline ? true : false, lastSeen, id]
    );
  },

  async setPin(id, pinHash) {
    await getPostgresPool().query('UPDATE users SET pin_hash = $1 WHERE id = $2', [pinHash, id]);
  },

  async getPin(id) {
    const res = await getPostgresPool().query('SELECT pin_hash FROM users WHERE id = $1', [id]);
    return res.rows[0]?.pin_hash || null;
  },

  async getAllMembers() {
    const res = await getPostgresPool().query('SELECT * FROM users ORDER BY id ASC');
    return res.rows.map(formatPgUser);
  },

  async getPeer(currentUserId) {
    const res = await getPostgresPool().query('SELECT * FROM users WHERE id != $1 LIMIT 1', [currentUserId]);
    return formatPgUser(res.rows[0]);
  }
};

// PostgreSQL Invite Repository
export const pgInviteRepo = {
  async create(code, createdBy) {
    const now = Math.floor(Date.now() / 1000);
    const res = await getPostgresPool().query(
      'INSERT INTO invites (code, created_by, created_at) VALUES ($1, $2, $3) RETURNING *',
      [code, createdBy, now]
    );
    return res.rows[0];
  },

  async findByCode(code) {
    const res = await getPostgresPool().query('SELECT * FROM invites WHERE code = $1', [code]);
    return res.rows[0] || null;
  },

  async findActive() {
    const res = await getPostgresPool().query('SELECT * FROM invites WHERE is_used = false ORDER BY id DESC LIMIT 1');
    return res.rows[0] || null;
  },

  async markUsed(code, usedBy) {
    await getPostgresPool().query('UPDATE invites SET is_used = true, used_by = $1 WHERE code = $2', [usedBy, code]);
  }
};

// PostgreSQL Message Repository
export const pgMessageRepo = {
  async create({
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
    const res = await getPostgresPool().query(
      `INSERT INTO messages (
        id, sender_id, recipient_id, content, is_encrypted, encryption_meta,
        type, media_url, media_meta, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        id,
        senderId,
        recipientId,
        content,
        Boolean(isEncrypted),
        encryptionMeta ? JSON.stringify(encryptionMeta) : null,
        type,
        mediaUrl,
        mediaMeta ? JSON.stringify(mediaMeta) : null,
        status,
        createdAt
      ]
    );
    return formatPgMessage(res.rows[0]);
  },

  async findById(id) {
    const res = await getPostgresPool().query('SELECT * FROM messages WHERE id = $1', [id]);
    return formatPgMessage(res.rows[0]);
  },

  async getHistory({ userId, peerId, limit = 100, beforeTimestamp = null }) {
    let query = `
      SELECT * FROM messages
      WHERE ((sender_id = $1 AND recipient_id = $2 AND deleted_for_sender = false)
         OR (sender_id = $2 AND recipient_id = $1 AND deleted_for_recipient = false))
    `;
    const params = [userId, peerId];

    if (beforeTimestamp) {
      query += ` AND created_at < $3`;
      params.push(beforeTimestamp);
      query += ` ORDER BY created_at ASC LIMIT $4`;
      params.push(limit);
    } else {
      query += ` ORDER BY created_at ASC LIMIT $3`;
      params.push(limit);
    }

    const res = await getPostgresPool().query(query, params);
    return res.rows.map(formatPgMessage);
  },

  async search({ userId, peerId, query }) {
    const sql = `
      SELECT * FROM messages
      WHERE ((sender_id = $1 AND recipient_id = $2 AND deleted_for_sender = false)
         OR (sender_id = $2 AND recipient_id = $1 AND deleted_for_recipient = false))
        AND content ILIKE $3
      ORDER BY created_at DESC LIMIT 50
    `;
    const res = await getPostgresPool().query(sql, [userId, peerId, `%${query}%`]);
    return res.rows.map(formatPgMessage);
  },

  async updateStatus(id, status, timestamp = Math.floor(Date.now() / 1000)) {
    if (status === 'delivered') {
      await getPostgresPool().query(
        `UPDATE messages SET status = 'delivered', delivered_at = COALESCE(delivered_at, $1) WHERE id = $2 AND status = 'sent'`,
        [timestamp, id]
      );
    } else if (status === 'read') {
      await getPostgresPool().query(
        `UPDATE messages SET status = 'read', delivered_at = COALESCE(delivered_at, $1), read_at = $1 WHERE id = $2`,
        [timestamp, id]
      );
    }
  },

  async markBatchAsDelivered(recipientId, timestamp = Math.floor(Date.now() / 1000)) {
    const res = await getPostgresPool().query(
      `UPDATE messages SET status = 'delivered', delivered_at = $1
       WHERE recipient_id = $2 AND status = 'sent' RETURNING id`,
      [timestamp, recipientId]
    );
    return res.rows.map(r => r.id);
  },

  async markBatchAsRead(recipientId, senderId, timestamp = Math.floor(Date.now() / 1000)) {
    const res = await getPostgresPool().query(
      `UPDATE messages SET status = 'read', delivered_at = COALESCE(delivered_at, $1), read_at = $1
       WHERE recipient_id = $2 AND sender_id = $3 AND status != 'read' RETURNING id`,
      [timestamp, recipientId, senderId]
    );
    return res.rows.map(r => r.id);
  },

  async deleteForUser(messageId, userId) {
    const res = await getPostgresPool().query('SELECT sender_id, recipient_id FROM messages WHERE id = $1', [messageId]);
    const msg = res.rows[0];
    if (!msg) return false;

    if (msg.sender_id === userId) {
      await getPostgresPool().query('UPDATE messages SET deleted_for_sender = true WHERE id = $1', [messageId]);
    } else if (msg.recipient_id === userId) {
      await getPostgresPool().query('UPDATE messages SET deleted_for_recipient = true WHERE id = $1', [messageId]);
    }
    return true;
  },

  async deleteForEveryone(messageId, senderId) {
    const res = await getPostgresPool().query('DELETE FROM messages WHERE id = $1 AND sender_id = $2', [messageId, senderId]);
    return res.rowCount > 0;
  }
};

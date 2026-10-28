/**
 * Optional MongoDB / Mongoose Reference Schemas
 * If switching to MongoDB, set MONGODB_URI in .env and use this schema reference.
 */
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, required: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: null },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  pinHash: { type: String, default: null },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  isEncrypted: { type: Boolean, default: false },
  encryptionMeta: {
    iv: String,
    salt: String,
    authTag: String
  },
  type: { type: String, enum: ['text', 'image', 'audio', 'file'], default: 'text' },
  mediaUrl: { type: String, default: null },
  mediaMeta: {
    fileName: String,
    fileSize: Number,
    mimeType: String,
    duration: Number
  },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent', index: true },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
  deletedForSender: { type: Boolean, default: false },
  deletedForRecipient: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Composite index for fast 1-on-1 chronological loading
MessageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });

export const MongoUser = mongoose.models.User || mongoose.model('User', UserSchema);
export const MongoMessage = mongoose.models.Message || mongoose.model('Message', MessageSchema);

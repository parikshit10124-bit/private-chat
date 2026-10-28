import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { userRepo, inviteRepo, getActiveDbEngine } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../config/security.js';

const router = express.Router();
const MAX_USERS = parseInt(process.env.MAX_USERS_ALLOWED, 10) || 2;

// Helper to sign JWT
const signToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper to set HTTP-only cookie
const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

/**
 * @route GET /api/auth/status
 * @desc Get instance registration status (0/2, 1/2, or 2/2 full) and active DB engine
 */
router.get('/status', async (req, res) => {
  try {
    const count = await userRepo.count();
    const isFull = count >= MAX_USERS;
    const activeInvite = await inviteRepo.findActive();

    res.json({
      success: true,
      data: {
        userCount: count,
        maxUsers: MAX_USERS,
        isFull,
        requiresInvite: count > 0 && !isFull,
        hasActiveInvite: Boolean(activeInvite),
        dbEngine: getActiveDbEngine()
      }
    });
  } catch (err) {
    console.error('Status Error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve instance status.' });
  }
});

/**
 * @route POST /api/auth/register
 * @desc Register user (restricted strictly to 2 accounts)
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, displayName, password, inviteCode } = req.body;

    // 1. Check strict 2-user capacity limit
    const currentCount = await userRepo.count();
    if (currentCount >= MAX_USERS) {
      return res.status(403).json({
        success: false,
        message: 'Registration closed. This private 1-on-1 instance has reached maximum capacity (2 users).'
      });
    }

    // 2. Validate input fields
    if (!username || !displayName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, Display Name, and Password are required.'
      });
    }

    if (username.length < 3 || username.length > 25 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-25 alphanumeric characters or underscores.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // 3. Existing username check
    const existing = await userRepo.findByUsername(username);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken.'
      });
    }

    // 4. Invite code verification for User 2 (if 1 user already exists)
    let isRoleAdmin = false;
    if (currentCount === 0) {
      isRoleAdmin = true; // First user is Admin
    } else {
      // Second user registration requires invite verification
      const envInvite = process.env.INVITE_CODE;
      if (envInvite && envInvite.trim().length > 0) {
        if (inviteCode !== envInvite) {
          return res.status(403).json({
            success: false,
            message: 'Invalid invite code. You must provide a valid invite code to claim the second seat.'
          });
        }
      } else {
        // Check dynamic database invite code
        const activeInvite = await inviteRepo.findActive();
        if (activeInvite) {
          if (!inviteCode || inviteCode.trim() !== activeInvite.code) {
            return res.status(403).json({
              success: false,
              message: 'Invalid or missing invite code. Please request an invite code from the first user.'
            });
          }
        }
      }
    }

    // 5. Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 12);

    // 6. Generate sleek default avatar initials
    const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=00a884,005c4b,111b21`;

    // 7. Save user
    const newUser = await userRepo.create({
      username: username.toLowerCase().trim(),
      displayName: displayName.trim(),
      passwordHash,
      avatar: defaultAvatar,
      role: isRoleAdmin ? 'admin' : 'member'
    });

    // 8. If second user registered using dynamic invite, mark invite as used
    if (currentCount > 0 && inviteCode) {
      await inviteRepo.markUsed(inviteCode, newUser.id);
    }

    // 9. If first user registered, automatically generate an invite code for User 2
    let generatedInvite = null;
    if (isRoleAdmin) {
      const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      generatedInvite = await inviteRepo.create(randomCode, newUser.id);
    }

    // 10. Issue session JWT
    const token = signToken(newUser);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        user: newUser,
        token,
        inviteCodeForPeer: generatedInvite ? generatedInvite.code : null,
        dbEngine: getActiveDbEngine()
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during registration. Please try again.'
    });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and issue JWT
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username and password.'
      });
    }

    const userWithHash = await userRepo.findByUsername(username);
    if (!userWithHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const isMatch = await bcrypt.compare(password, userWithHash.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.'
      });
    }

    // Sanitize user object for response
    const user = await userRepo.findById(userWithHash.id);
    const token = signToken(user);
    setAuthCookie(res, token);

    // Update last seen
    await userRepo.updateOnlineStatus(user.id, 1);

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user,
        token,
        dbEngine: getActiveDbEngine()
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during authentication.'
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Clear auth cookie & set user offline
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await userRepo.updateOnlineStatus(req.user.id, 0);
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax'
    });
    return res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (err) {
    console.error('Logout Error:', err);
    return res.status(500).json({ success: false, message: 'Logout failed.' });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current session, peer information, and instance state
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const peer = await userRepo.getPeer(req.user.id);
    const userCount = await userRepo.count();
    const activeInvite = await inviteRepo.findActive();

    return res.json({
      success: true,
      data: {
        user: req.user,
        peer: peer || null,
        userCount,
        isFull: userCount >= MAX_USERS,
        activeInviteCode: activeInvite ? activeInvite.code : null,
        dbEngine: getActiveDbEngine()
      }
    });
  } catch (err) {
    console.error('Me Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
});

/**
 * @route POST /api/auth/invite
 * @desc Generate or fetch active invite code for the 2nd seat
 */
router.post('/invite', requireAuth, async (req, res) => {
  try {
    const userCount = await userRepo.count();
    if (userCount >= MAX_USERS) {
      return res.status(400).json({
        success: false,
        message: 'Both seats are already occupied.'
      });
    }

    let activeInvite = await inviteRepo.findActive();
    if (!activeInvite) {
      const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      activeInvite = await inviteRepo.create(randomCode, req.user.id);
    }

    return res.json({
      success: true,
      data: {
        inviteCode: activeInvite.code
      }
    });
  } catch (err) {
    console.error('Invite Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create invite.' });
  }
});

/**
 * @route POST /api/auth/pin
 * @desc Set or update quick unlock PIN
 */
router.post('/pin', requireAuth, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be between 4 and 8 digits.'
      });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    await userRepo.setPin(req.user.id, pinHash);

    return res.json({
      success: true,
      message: 'Quick Unlock PIN configured.'
    });
  } catch (err) {
    console.error('PIN Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to set PIN.' });
  }
});

/**
 * @route POST /api/auth/verify-pin
 * @desc Verify PIN or account password to unlock auto-lock screen
 */
router.post('/verify-pin', requireAuth, async (req, res) => {
  try {
    const { pin, password } = req.body;

    if (pin) {
      const storedPinHash = await userRepo.getPin(req.user.id);
      if (storedPinHash) {
        const match = await bcrypt.compare(pin, storedPinHash);
        if (match) {
          return res.json({ success: true, message: 'Unlocked successfully.' });
        }
      }
    }

    if (password) {
      const userWithHash = await userRepo.findByUsername(req.user.username);
      if (userWithHash) {
        const match = await bcrypt.compare(password, userWithHash.passwordHash);
        if (match) {
          return res.json({ success: true, message: 'Unlocked successfully.' });
        }
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Incorrect PIN or password.'
    });
  } catch (err) {
    console.error('Verify PIN Error:', err);
    return res.status(500).json({ success: false, message: 'Verification error.' });
  }
});

export default router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'otp-authenticator.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const OTP_ISSUER = process.env.OTP_ISSUER || 'FinTrack';

const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const generateOtpSecret = () => {
  const bytes = crypto.randomBytes(10);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  return bits.match(/.{1,5}/g).map(chunk => base32Chars[parseInt(chunk.padEnd(5, '0'), 2)]).join('');
};

const signAuthToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
const signOtpToken = (userId) => jwt.sign({ userId, purpose: 'otp' }, JWT_SECRET, { expiresIn: '10m' });

const serializeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  currency: user.currency || 'INR',
  dark_mode: user.dark_mode,
  profile_photo: user.profile_photo
});

const rapidOtpRequest = async (path, payload) => {
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY is not configured');
  }

  const response = await fetch(`https://${RAPIDAPI_HOST}${path}`, {
    method: 'POST',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(payload).toString()
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(typeof data === 'string' ? data : data?.message || 'RapidAPI OTP request failed');
  }

  return data;
};

const isOtpValid = (result) => {
  if (result === true) return true;
  if (typeof result === 'string') {
    const normalized = result.toLowerCase();
    return normalized.includes('true') || normalized.includes('valid') || normalized.includes('success');
  }
  if (!result || typeof result !== 'object') return false;
  return result.valid === true || result.success === true || result.status === 'valid' || result.status === true;
};

const createOtpChallenge = async (user, includeSetup = false) => {
  let secret = user.otp_secret;
  if (!secret) {
    secret = generateOtpSecret();
    await pool.execute('UPDATE users SET otp_secret = ? WHERE id = ?', [secret, user.id]);
  }

  const challenge = {
    otp_required: true,
    otp_setup_required: includeSetup || !user.otp_enabled,
    pending_token: signOtpToken(user.id)
  };

  if (challenge.otp_setup_required) {
    challenge.otp_setup = await rapidOtpRequest('/enroll/', {
      secret,
      account: user.email,
      issuer: OTP_ISSUER,
      printQR: true
    });
    challenge.manual_secret = secret;
  }

  return challenge;
};

// Default categories for new users
const defaultCategories = [
  { name: 'Salary', type: 'income', color: '#10b981', icon: '💼' },
  { name: 'Freelance', type: 'income', color: '#6366f1', icon: '💻' },
  { name: 'Business', type: 'income', color: '#f59e0b', icon: '🏢' },
  { name: 'Investment', type: 'income', color: '#3b82f6', icon: '📈' },
  { name: 'Other Income', type: 'income', color: '#8b5cf6', icon: '💰' },
  { name: 'Food & Dining', type: 'expense', color: '#ef4444', icon: '🍔' },
  { name: 'Transport', type: 'expense', color: '#f97316', icon: '🚗' },
  { name: 'Shopping', type: 'expense', color: '#ec4899', icon: '🛍️' },
  { name: 'Entertainment', type: 'expense', color: '#8b5cf6', icon: '🎬' },
  { name: 'Healthcare', type: 'expense', color: '#14b8a6', icon: '🏥' },
  { name: 'Utilities', type: 'expense', color: '#64748b', icon: '💡' },
  { name: 'Rent', type: 'expense', color: '#dc2626', icon: '🏠' },
  { name: 'Education', type: 'expense', color: '#2563eb', icon: '📚' },
  { name: 'Travel', type: 'expense', color: '#059669', icon: '✈️' },
  { name: 'Other Expense', type: 'expense', color: '#6b7280', icon: '📝' },
];

// Register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be 6+ characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, phone } = req.body;

  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await pool.execute(
      'INSERT INTO users (id, name, email, password, phone) VALUES (?, ?, ?, ?, ?)',
      [userId, name, email, hashedPassword, phone || null]
    );

    // Create default categories
    for (const cat of defaultCategories) {
      await pool.execute(
        'INSERT INTO categories (id, user_id, name, type, color, icon, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, cat.name, cat.type, cat.color, cat.icon, true]
      );
    }

    res.status(201).json({
      ...(await createOtpChallenge({ id: userId, name, email, phone, currency: 'INR' }, true)),
      user: { id: userId, name, email, phone, currency: 'INR' }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      ...(await createOtpChallenge(user)),
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify authenticator OTP and issue session token
router.post('/verify-otp', [
  body('pending_token').notEmpty(),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('Enter a 6 digit code'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { pending_token, code } = req.body;

  try {
    const decoded = jwt.verify(pending_token, JWT_SECRET);
    if (decoded.purpose !== 'otp') {
      return res.status(401).json({ error: 'Invalid OTP session' });
    }

    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0 || !users[0].otp_secret) {
      return res.status(401).json({ error: 'Invalid OTP session' });
    }

    const result = await rapidOtpRequest('/validate/', {
      secret: users[0].otp_secret,
      code
    });

    if (!isOtpValid(result)) {
      return res.status(401).json({ error: 'Invalid OTP code' });
    }

    await pool.execute('UPDATE users SET otp_enabled = TRUE WHERE id = ?', [users[0].id]);

    res.json({
      token: signAuthToken(users[0].id),
      user: serializeUser(users[0])
    });
  } catch (error) {
    console.error('OTP verify error:', error);
    res.status(401).json({ error: 'OTP verification failed' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, phone, currency, dark_mode, profile_photo, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Forgot password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  const { email } = req.body;
  try {
    const [users] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.json({ message: 'If email exists, reset link sent' });
    }

    const token = uuidv4();
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await pool.execute(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
      [token, expiry, email]
    );

    // In production, send email here
    res.json({ 
      message: 'Password reset link sent',
      // Only for development/demo
      reset_token: token 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 }),
], async (req, res) => {
  const { token, password } = req.body;
  try {
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await pool.execute(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [hashedPassword, users[0].id]
    );

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;

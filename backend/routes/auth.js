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
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'FinTrack <onboarding@resend.dev>';
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES) || 5;

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

const hashOtp = (code) => crypto.createHash('sha256').update(code).digest('hex');

const sendOtpEmail = async (email, code) => {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: 'Your FinTrack verification code',
      html: `<p>Your FinTrack verification code is:</p><h2>${code}</h2><p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`,
      text: `Your FinTrack verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Failed to send OTP email');
  }
};

const createOtpChallenge = async (user) => {
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.execute(
    'UPDATE users SET otp_code_hash = ?, otp_expires_at = ? WHERE id = ?',
    [hashOtp(code), expiresAt, user.id]
  );

  await sendOtpEmail(user.email, code);

  return {
    otp_required: true,
    otp_channel: 'email',
    pending_token: signOtpToken(user.id),
    email: user.email
  };
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
      ...(await createOtpChallenge({ id: userId, name, email, phone, currency: 'INR' })),
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

// Verify email OTP and issue session token
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
    if (users.length === 0 || !users[0].otp_code_hash || !users[0].otp_expires_at) {
      return res.status(401).json({ error: 'Invalid OTP session' });
    }

    if (new Date(users[0].otp_expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: 'OTP code expired' });
    }

    if (hashOtp(code) !== users[0].otp_code_hash) {
      return res.status(401).json({ error: 'Invalid OTP code' });
    }

    await pool.execute(
      'UPDATE users SET otp_enabled = TRUE, otp_code_hash = NULL, otp_expires_at = NULL WHERE id = ?',
      [users[0].id]
    );

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

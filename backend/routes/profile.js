const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const pool = require('../config/database');
const auth = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/', auth, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, phone, currency, dark_mode, profile_photo, created_at FROM users WHERE id = ?',
      [req.userId]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/', auth, async (req, res) => {
  try {
    const { name, phone, currency, dark_mode } = req.body;
    await pool.execute(
      'UPDATE users SET name=?, phone=?, currency=?, dark_mode=? WHERE id=?',
      [name, phone || null, currency || 'INR', dark_mode || false, req.userId]
    );
    const [users] = await pool.execute(
      'SELECT id, name, email, phone, currency, dark_mode, profile_photo FROM users WHERE id = ?',
      [req.userId]
    );
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/photo', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    await pool.execute('UPDATE users SET profile_photo=? WHERE id=?', [photoUrl, req.userId]);
    res.json({ profile_photo: photoUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

router.put('/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password must be 6+ characters' });

    const [users] = await pool.execute('SELECT password FROM users WHERE id=?', [req.userId]);
    const isMatch = await bcrypt.compare(current_password, users[0].password);
    if (!isMatch) return res.status(400).json({ error: 'Current password incorrect' });

    const hashed = await bcrypt.hash(new_password, 12);
    await pool.execute('UPDATE users SET password=? WHERE id=?', [hashed, req.userId]);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;

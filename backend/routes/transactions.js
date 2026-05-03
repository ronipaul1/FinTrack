const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, validationResult, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const pool = require('../config/database');
const auth = require('../middleware/auth');

// Multer setup for receipts
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/receipts')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  }
});

// Ensure uploads directory exists
const fs = require('fs');
const uploadDir = path.join(__dirname, '../uploads/receipts');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const toBooleanValue = (value) => {
  if (value === true || value === 'true' || value === '1' || value === 1) return 1;
  return 0;
};

// Get all transactions
router.get('/', auth, async (req, res) => {
  try {
    const { type, category_id, start_date, end_date, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offsetNum = (pageNum - 1) * limitNum;
    
    let sql = `
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
    `;
    const params = [req.userId];

    if (type) { sql += ' AND t.type = ?'; params.push(type); }
    if (category_id) { sql += ' AND t.category_id = ?'; params.push(category_id); }
    if (start_date) { sql += ' AND t.date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND t.date <= ?'; params.push(end_date); }
    if (search) { sql += ' AND (t.description LIKE ? OR t.notes LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    // Count total
    const countSql = sql.replace('SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon', 'SELECT COUNT(*) as total');
    const [countResult] = await pool.execute(countSql, params);
    const total = countResult[0].total;

    sql += ` ORDER BY t.date DESC, t.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const [transactions] = await pool.execute(sql, params);
    
    res.json({
      transactions,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get summary stats
router.get('/summary', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    const [income] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
       WHERE user_id = ? AND type = 'income' AND MONTH(date) = ? AND YEAR(date) = ?`,
      [req.userId, currentMonth, currentYear]
    );

    const [expense] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
       WHERE user_id = ? AND type = 'expense' AND MONTH(date) = ? AND YEAR(date) = ?`,
      [req.userId, currentMonth, currentYear]
    );

    const [totalBalance] = await pool.execute(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance
       FROM transactions WHERE user_id = ?`,
      [req.userId]
    );

    res.json({
      monthly_income: parseFloat(income[0].total),
      monthly_expense: parseFloat(expense[0].total),
      monthly_savings: parseFloat(income[0].total) - parseFloat(expense[0].total),
      total_balance: parseFloat(totalBalance[0].balance)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Add transaction
router.post('/', auth, upload.single('receipt'), [
  body('type').isIn(['income', 'expense']),
  body('amount').isFloat({ min: 0.01 }),
  body('date').isDate(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { type, amount, category_id, description, date, tags, is_recurring, recurring_interval, notes, currency } = req.body;

  try {
    const id = uuidv4();
    const receipt_url = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const tagsJson = tags ? JSON.stringify(typeof tags === 'string' ? JSON.parse(tags) : tags) : null;

    await pool.execute(
      `INSERT INTO transactions (id, user_id, type, amount, category_id, description, date, tags, receipt_url, is_recurring, recurring_interval, notes, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.userId, type, amount, category_id || null, description || null, date, tagsJson, receipt_url, toBooleanValue(is_recurring), recurring_interval || null, notes || null, currency || 'INR']
    );

    const [newTransaction] = await pool.execute(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?`,
      [id]
    );

    res.status(201).json(newTransaction[0]);
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

// Update transaction
router.put('/:id', auth, upload.single('receipt'), async (req, res) => {
  const { id } = req.params;
  const { type, amount, category_id, description, date, tags, is_recurring, recurring_interval, notes, currency } = req.body;

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    const receipt_url = req.file ? `/uploads/receipts/${req.file.filename}` : undefined;
    const tagsJson = tags ? JSON.stringify(typeof tags === 'string' ? JSON.parse(tags) : tags) : null;

    let sql = `UPDATE transactions SET type=?, amount=?, category_id=?, description=?, date=?, tags=?, is_recurring=?, recurring_interval=?, notes=?, currency=?`;
    const params = [type, amount, category_id || null, description || null, date, tagsJson, toBooleanValue(is_recurring), recurring_interval || null, notes || null, currency || 'INR'];

    if (receipt_url) { sql += ', receipt_url=?'; params.push(receipt_url); }
    sql += ' WHERE id = ? AND user_id = ?';
    params.push(id, req.userId);

    await pool.execute(sql, params);

    const [updated] = await pool.execute(
      `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
       FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ?`,
      [id]
    );

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
router.delete('/:id', auth, async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;

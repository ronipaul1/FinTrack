const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { start_date, end_date, type, category_id } = req.query;

    let sql = `
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
    `;
    const params = [req.userId];

    if (start_date) { sql += ' AND t.date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND t.date <= ?'; params.push(end_date); }
    if (type) { sql += ' AND t.type = ?'; params.push(type); }
    if (category_id) { sql += ' AND t.category_id = ?'; params.push(category_id); }

    sql += ' ORDER BY t.date DESC';
    const [transactions] = await pool.execute(sql, params);

    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);

    res.json({
      transactions,
      summary: { income, expense, savings: income - expense, count: transactions.length }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statement' });
  }
});

module.exports = router;

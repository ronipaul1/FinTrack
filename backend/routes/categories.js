const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM categories WHERE user_id = ?';
    const params = [req.userId];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY is_default DESC, name ASC';
    const [cats] = await pool.execute(sql, params);
    res.json(cats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, type, color, icon } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type required' });
    const id = uuidv4();
    await pool.execute(
      'INSERT INTO categories (id, user_id, name, type, color, icon) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.userId, name, type, color || '#6366f1', icon || '💰']
    );
    const [cat] = await pool.execute('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json(cat[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    await pool.execute(
      'UPDATE categories SET name=?, color=?, icon=? WHERE id=? AND user_id=?',
      [name, color, icon, req.params.id, req.userId]
    );
    const [cat] = await pool.execute('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(cat[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const [cat] = await pool.execute('SELECT is_default FROM categories WHERE id=? AND user_id=?', [req.params.id, req.userId]);
    if (cat.length === 0) return res.status(404).json({ error: 'Not found' });
    if (cat[0].is_default) return res.status(400).json({ error: 'Cannot delete default category' });
    await pool.execute('DELETE FROM categories WHERE id=? AND user_id=?', [req.params.id, req.userId]);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;

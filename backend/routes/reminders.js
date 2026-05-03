const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM reminders WHERE user_id=? ORDER BY due_date ASC',
      [req.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, description, due_date, amount, type } = req.body;
    if (!title || !due_date) return res.status(400).json({ error: 'Title and due date required' });
    const id = uuidv4();
    await pool.execute(
      'INSERT INTO reminders (id, user_id, title, description, due_date, amount, type) VALUES (?,?,?,?,?,?,?)',
      [id, req.userId, title, description || null, due_date, amount || null, type || 'custom']
    );
    const [reminder] = await pool.execute('SELECT * FROM reminders WHERE id=?', [id]);
    res.status(201).json(reminder[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

router.put('/:id/complete', auth, async (req, res) => {
  try {
    await pool.execute(
      'UPDATE reminders SET is_completed=? WHERE id=? AND user_id=?',
      [true, req.params.id, req.userId]
    );
    res.json({ message: 'Reminder completed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.execute('DELETE FROM reminders WHERE id=? AND user_id=?', [req.params.id, req.userId]);
    res.json({ message: 'Reminder deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

module.exports = router;

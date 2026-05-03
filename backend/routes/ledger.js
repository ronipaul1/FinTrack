const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const auth = require('../middleware/auth');

// Get all customers
router.get('/customers', auth, async (req, res) => {
  try {
    const [customers] = await pool.execute(`
      SELECT c.*,
        COALESCE(SUM(CASE WHEN le.type='given' THEN le.amount ELSE -le.amount END), 0) as balance
      FROM customers c
      LEFT JOIN ledger_entries le ON c.id = le.customer_id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.name
    `, [req.userId]);

    res.json(customers.map(c => ({ ...c, balance: parseFloat(c.balance) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Add customer
router.post('/customers', auth, async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const id = uuidv4();
    await pool.execute(
      'INSERT INTO customers (id, user_id, name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.userId, name, phone || null, email || null, address || null, notes || null]
    );

    const [customer] = await pool.execute('SELECT * FROM customers WHERE id = ?', [id]);
    res.status(201).json({ ...customer[0], balance: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add customer' });
  }
});

// Update customer
router.put('/customers/:id', auth, async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    await pool.execute(
      'UPDATE customers SET name=?, phone=?, email=?, address=?, notes=? WHERE id=? AND user_id=?',
      [name, phone || null, email || null, address || null, notes || null, req.params.id, req.userId]
    );
    const [updated] = await pool.execute('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/customers/:id', auth, async (req, res) => {
  try {
    await pool.execute('DELETE FROM customers WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Get ledger for customer
router.get('/customers/:id/entries', auth, async (req, res) => {
  try {
    const [customer] = await pool.execute('SELECT * FROM customers WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (customer.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const [entries] = await pool.execute(
      'SELECT * FROM ledger_entries WHERE customer_id = ? ORDER BY date DESC',
      [req.params.id]
    );

    const [balanceResult] = await pool.execute(
      `SELECT COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE -amount END), 0) as balance
       FROM ledger_entries WHERE customer_id = ?`,
      [req.params.id]
    );

    res.json({
      customer: customer[0],
      entries: entries.map(e => ({ ...e, amount: parseFloat(e.amount) })),
      balance: parseFloat(balanceResult[0].balance)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

// Add ledger entry
router.post('/entries', auth, async (req, res) => {
  try {
    const { customer_id, type, amount, date, notes } = req.body;
    if (!customer_id || !type || !amount || !date) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const [customer] = await pool.execute('SELECT id FROM customers WHERE id = ? AND user_id = ?', [customer_id, req.userId]);
    if (customer.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const id = uuidv4();
    await pool.execute(
      'INSERT INTO ledger_entries (id, user_id, customer_id, type, amount, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.userId, customer_id, type, amount, date, notes || null]
    );

    const [entry] = await pool.execute('SELECT * FROM ledger_entries WHERE id = ?', [id]);
    res.status(201).json({ ...entry[0], amount: parseFloat(entry[0].amount) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add entry' });
  }
});

// Delete ledger entry
router.delete('/entries/:id', auth, async (req, res) => {
  try {
    await pool.execute('DELETE FROM ledger_entries WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ message: 'Entry deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const auth = require('../middleware/auth');

// Get all invoices
router.get('/', auth, async (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = 'SELECT * FROM invoices WHERE user_id = ?';
    const params = [req.userId];

    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (search) { sql += ' AND (client_name LIKE ? OR invoice_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    sql += ' ORDER BY created_at DESC';
    const [invoices] = await pool.execute(sql, params);

    res.json(invoices.map(inv => ({ ...inv, items: typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get invoice by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = rows[0];
    res.json({ ...inv, items: typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Create invoice
router.post('/', auth, async (req, res) => {
  try {
    const { client_name, client_email, client_phone, client_address, items, tax_rate, due_date, notes, gst_number, currency } = req.body;

    // Generate invoice number
    const [countResult] = await pool.execute('SELECT COUNT(*) as count FROM invoices WHERE user_id = ?', [req.userId]);
    const invoiceNumber = `INV-${String(countResult[0].count + 1).padStart(4, '0')}`;

    const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
    const subtotal = itemsArray.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxRate = parseFloat(tax_rate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO invoices (id, user_id, invoice_number, client_name, client_email, client_phone, client_address, items, subtotal, tax_rate, tax_amount, total, due_date, notes, gst_number, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.userId, invoiceNumber, client_name, client_email || null, client_phone || null, client_address || null, JSON.stringify(itemsArray), subtotal, taxRate, taxAmount, total, due_date || null, notes || null, gst_number || null, currency || 'INR']
    );

    const [newInv] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [id]);
    const inv = newInv[0];
    res.status(201).json({ ...inv, items: typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update invoice
router.put('/:id', auth, async (req, res) => {
  try {
    const { client_name, client_email, client_phone, client_address, items, tax_rate, due_date, notes, gst_number, status, paid_date } = req.body;

    const [existing] = await pool.execute('SELECT id FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
    const subtotal = itemsArray.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxRate = parseFloat(tax_rate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    await pool.execute(
      `UPDATE invoices SET client_name=?, client_email=?, client_phone=?, client_address=?, items=?, subtotal=?, tax_rate=?, tax_amount=?, total=?, due_date=?, notes=?, gst_number=?, status=?, paid_date=? WHERE id=? AND user_id=?`,
      [client_name, client_email || null, client_phone || null, client_address || null, JSON.stringify(itemsArray), subtotal, taxRate, taxAmount, total, due_date || null, notes || null, gst_number || null, status || 'draft', paid_date || null, req.params.id, req.userId]
    );

    const [updated] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    const inv = updated[0];
    res.json({ ...inv, items: typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Delete invoice
router.delete('/:id', auth, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;

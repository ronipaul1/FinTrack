const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

// Monthly trend (12 months)
router.get('/monthly-trend', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        YEAR(date) as year,
        MONTH(date) as month,
        type,
        SUM(amount) as total
      FROM transactions
      WHERE user_id = ? AND date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY YEAR(date), MONTH(date), type
      ORDER BY year, month
    `, [req.userId]);

    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        income: 0,
        expense: 0
      });
    }

    rows.forEach(row => {
      const m = months.find(m => m.year === row.year && m.month === row.month);
      if (m) m[row.type] = parseFloat(row.total);
    });

    months.forEach(m => { m.savings = m.income - m.expense; });

    res.json(months);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monthly trend' });
  }
});

// Category breakdown
router.get('/category-breakdown', auth, async (req, res) => {
  try {
    const { type = 'expense', month, year } = req.query;
    const currentMonth = month || new Date().getMonth() + 1;
    const currentYear = year || new Date().getFullYear();

    const [rows] = await pool.execute(`
      SELECT 
        c.name, c.color, c.icon,
        SUM(t.amount) as total,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type = ? 
        AND MONTH(t.date) = ? AND YEAR(t.date) = ?
      GROUP BY t.category_id, c.name, c.color, c.icon
      ORDER BY total DESC
    `, [req.userId, type, currentMonth, currentYear]);

    res.json(rows.map(r => ({
      ...r,
      total: parseFloat(r.total)
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch category breakdown' });
  }
});

// Yearly summary
router.get('/yearly', auth, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();

    const [monthly] = await pool.execute(`
      SELECT 
        MONTH(date) as month,
        type,
        SUM(amount) as total
      FROM transactions
      WHERE user_id = ? AND YEAR(date) = ?
      GROUP BY MONTH(date), type
    `, [req.userId, year]);

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
      income: 0,
      expense: 0,
      savings: 0
    }));

    monthly.forEach(row => {
      const m = months[row.month - 1];
      m[row.type] = parseFloat(row.total);
    });
    months.forEach(m => { m.savings = m.income - m.expense; });

    const [totals] = await pool.execute(`
      SELECT type, SUM(amount) as total FROM transactions
      WHERE user_id = ? AND YEAR(date) = ?
      GROUP BY type
    `, [req.userId, year]);

    const income = totals.find(t => t.type === 'income')?.total || 0;
    const expense = totals.find(t => t.type === 'expense')?.total || 0;

    res.json({ monthly: months, income: parseFloat(income), expense: parseFloat(expense), savings: parseFloat(income) - parseFloat(expense) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch yearly analytics' });
  }
});

// AI Insights
router.get('/insights', auth, async (req, res) => {
  try {
    const thisMonth = new Date().getMonth() + 1;
    const thisYear = new Date().getFullYear();
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
    const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear;

    const [catThisMonth] = await pool.execute(`
      SELECT c.name, SUM(t.amount) as total
      FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type = 'expense' AND MONTH(t.date) = ? AND YEAR(t.date) = ?
      GROUP BY t.category_id, c.name ORDER BY total DESC LIMIT 1
    `, [req.userId, thisMonth, thisYear]);

    const [incomeThis] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id=? AND type='income' AND MONTH(date)=? AND YEAR(date)=?`,
      [req.userId, thisMonth, thisYear]
    );
    const [incomeLast] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id=? AND type='income' AND MONTH(date)=? AND YEAR(date)=?`,
      [req.userId, lastMonth, lastYear]
    );
    const [expenseThis] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id=? AND type='expense' AND MONTH(date)=? AND YEAR(date)=?`,
      [req.userId, thisMonth, thisYear]
    );
    const [expenseLast] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id=? AND type='expense' AND MONTH(date)=? AND YEAR(date)=?`,
      [req.userId, lastMonth, lastYear]
    );

    const insights = [];
    const iThis = parseFloat(incomeThis[0].total);
    const iLast = parseFloat(incomeLast[0].total);
    const eThis = parseFloat(expenseThis[0].total);
    const eLast = parseFloat(expenseLast[0].total);

    const savingsThis = iThis - eThis;
    const savingsLast = iLast - eLast;
    const savingsChange = savingsLast > 0 ? ((savingsThis - savingsLast) / savingsLast * 100).toFixed(1) : 0;

    if (catThisMonth.length > 0) {
      const cat = catThisMonth[0];
      const pct = iThis > 0 ? ((parseFloat(cat.total) / iThis) * 100).toFixed(0) : 0;
      if (pct > 30) {
        insights.push({ type: 'warning', icon: '⚠️', title: `High ${cat.name} spending`, message: `You spent ${pct}% of your income on ${cat.name} this month. Consider reducing this.` });
      }
    }

    if (savingsChange < -20) {
      insights.push({ type: 'alert', icon: '📉', title: 'Savings dropped', message: `Your savings dropped by ${Math.abs(savingsChange)}% compared to last month.` });
    } else if (savingsChange > 10) {
      insights.push({ type: 'success', icon: '🎉', title: 'Great savings!', message: `Your savings increased by ${savingsChange}% this month. Keep it up!` });
    }

    if (eThis > iThis && iThis > 0) {
      insights.push({ type: 'alert', icon: '🚨', title: 'Overspending alert', message: `Your expenses exceed your income this month by ₹${(eThis - iThis).toFixed(2)}.` });
    }

    if (iThis > iLast * 1.1 && iLast > 0) {
      insights.push({ type: 'success', icon: '💹', title: 'Income growth', message: `Your income grew by ${(((iThis - iLast) / iLast) * 100).toFixed(1)}% compared to last month.` });
    }

    if (insights.length === 0) {
      insights.push({ type: 'info', icon: '💡', title: 'Keep tracking', message: 'Add more transactions to get personalized financial insights.' });
    }

    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Daily spending (last 30 days)
router.get('/daily', auth, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DATE(date) as day, type, SUM(amount) as total
      FROM transactions
      WHERE user_id = ? AND date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(date), type
      ORDER BY day
    `, [req.userId]);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily data' });
  }
});

module.exports = router;

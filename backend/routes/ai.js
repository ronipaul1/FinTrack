const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Simple AI categorization based on keywords
const categorizeExpense = (description) => {
  const d = description.toLowerCase();
  if (/food|eat|restaurant|pizza|burger|lunch|dinner|breakfast|coffee|chai|tiffin|zomato|swiggy/.test(d)) return 'Food & Dining';
  if (/uber|ola|metro|bus|train|fuel|petrol|diesel|auto|cab|travel/.test(d)) return 'Transport';
  if (/amazon|flipkart|shopping|clothes|shoes|shirt|mall/.test(d)) return 'Shopping';
  if (/movie|netflix|hotstar|game|entertainment|concert/.test(d)) return 'Entertainment';
  if (/doctor|hospital|medicine|pharmacy|health|clinic/.test(d)) return 'Healthcare';
  if (/electricity|water|internet|wifi|bill|recharge|mobile/.test(d)) return 'Utilities';
  if (/rent|house|apartment|pg|flat/.test(d)) return 'Rent';
  if (/school|college|course|book|education|tuition/.test(d)) return 'Education';
  if (/salary|income|pay|freelance/.test(d)) return 'Salary';
  return null;
};

router.post('/categorize', auth, (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });
  const category = categorizeExpense(description);
  res.json({ suggested_category: category, confidence: category ? 0.85 : 0 });
});

// Budget suggestions
router.post('/budget-suggestion', auth, async (req, res) => {
  const { income } = req.body;
  if (!income) return res.status(400).json({ error: 'Income required' });

  const suggestions = [
    { category: 'Housing/Rent', percentage: 30, amount: income * 0.3, tip: 'Keep housing under 30% of income' },
    { category: 'Food & Dining', percentage: 15, amount: income * 0.15, tip: 'Cook at home to save more' },
    { category: 'Transport', percentage: 10, amount: income * 0.1, tip: 'Use public transport when possible' },
    { category: 'Utilities', percentage: 10, amount: income * 0.1, tip: 'Optimize electricity and internet plans' },
    { category: 'Healthcare', percentage: 5, amount: income * 0.05, tip: 'Maintain health insurance' },
    { category: 'Entertainment', percentage: 5, amount: income * 0.05, tip: 'Budget for fun but stay disciplined' },
    { category: 'Savings', percentage: 20, amount: income * 0.2, tip: 'Pay yourself first!' },
    { category: 'Emergency Fund', percentage: 5, amount: income * 0.05, tip: 'Build 3-6 months of expenses' },
  ];

  res.json({ suggestions, rule: '50/30/20 rule adapted for Indian households' });
});

module.exports = router;

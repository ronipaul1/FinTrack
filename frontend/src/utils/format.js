export const formatCurrency = (amount, currency = 'INR') => {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
  const symbol = symbols[currency] || currency;
  const num = parseFloat(amount) || 0;
  if (num >= 10000000) return `${symbol}${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `${symbol}${(num / 100000).toFixed(2)}L`;
  if (num >= 1000) return `${symbol}${(num / 1000).toFixed(1)}K`;
  return `${symbol}${num.toFixed(2)}`;
};

export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateInput = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
};

export const today = () => new Date().toISOString().split('T')[0];

export const monthYear = (date) => {
  return new Date(date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { today } from '../../utils/format';
import { RiAddLine, RiCloseLine, RiMagicLine } from 'react-icons/ri';

const TAGS = ['urgent', 'recurring', 'reimbursable', 'personal', 'business', 'tax-deductible'];
const CATEGORY_ICONS = [
  '💼', '💻', '🏢', '📈', '💰', '💵', '🏦', '🧾', '🎁', '🪙',
  '🍔', '🍕', '☕', '🛒', '🛍️', '🚗', '🚌', '⛽', '🏠', '💡',
  '📱', '🌐', '🎬', '🎮', '🎵', '🏥', '💊', '🏋️', '📚', '✈️',
  '🏨', '🐾', '👕', '💅', '🔧', '🧰', '🧑‍💼', '👨‍👩‍👧', '📝', '⭐',
];
const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#64748b'];

export default function TransactionModal({ transaction, defaultType = 'expense', onClose, onSave }) {
  const [form, setForm] = useState({
    type: defaultType,
    amount: '',
    category_id: '',
    description: '',
    date: today(),
    tags: [],
    is_recurring: false,
    recurring_interval: 'monthly',
    notes: '',
    currency: 'INR',
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showCategoryCreator, setShowCategoryCreator] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', icon: '⭐' });

  const loadCategories = useCallback(async (type) => {
    try {
      const res = await api.get(`/categories?type=${type}`);
      setCategories(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    if (transaction) {
      setForm({
        type: transaction.type || defaultType,
        amount: transaction.amount || '',
        category_id: transaction.category_id || '',
        description: transaction.description || '',
        date: transaction.date ? transaction.date.split('T')[0] : today(),
        tags: transaction.tags ? (typeof transaction.tags === 'string' ? JSON.parse(transaction.tags) : transaction.tags) : [],
        is_recurring: transaction.is_recurring || false,
        recurring_interval: transaction.recurring_interval || 'monthly',
        notes: transaction.notes || '',
        currency: transaction.currency || 'INR',
      });
    }
  }, [transaction, defaultType]);

  useEffect(() => {
    loadCategories(form.type);
  }, [form.type, loadCategories]);

  const suggestCategory = async () => {
    if (!form.description) { toast.error('Enter a description first'); return; }
    setAiLoading(true);
    try {
      const res = await api.post('/ai/categorize', { description: form.description });
      if (res.data.suggested_category) {
        const match = categories.find(c => c.name === res.data.suggested_category);
        if (match) {
          setForm(f => ({ ...f, category_id: match.id }));
          toast.success(`Suggested: ${match.name}`);
        } else {
          toast('No matching category found', { icon: '🤔' });
        }
      }
    } catch {
      toast.error('AI categorization failed');
    } finally {
      setAiLoading(false);
    }
  };

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };

  const createCategory = async () => {
    const name = newCategory.name.trim();
    if (!name) { toast.error('Enter a category name'); return; }
    setCategorySaving(true);
    try {
      const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
      const res = await api.post('/categories', {
        name,
        type: form.type,
        icon: newCategory.icon || '⭐',
        color,
      });
      const created = res.data;
      setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(f => ({ ...f, category_id: created.id }));
      setNewCategory({ name: '', icon: '⭐' });
      setShowCategoryCreator(false);
      toast.success('Category created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create category');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'tags') fd.append(k, JSON.stringify(v));
        else if (v !== null && v !== undefined && v !== '') fd.append(k, v);
      });
      if (receipt) fd.append('receipt', receipt);

      if (transaction) {
        await api.put(`/transactions/${transaction.id}`, fd);
        toast.success('Transaction updated!');
      } else {
        await api.post('/transactions', fd);
        toast.success('Transaction added!');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{transaction ? 'Edit' : 'Add'} Transaction</h2>
          <button className="btn btn-ghost" onClick={onClose}><RiCloseLine size={20} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, padding: 4, background: 'var(--bg-input)', borderRadius: 12 }}>
            {['income', 'expense'].map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t, category_id: '' }))} style={{
                flex: 1, padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-main)', fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
                background: form.type === t ? (t === 'income' ? 'var(--gradient-2)' : 'var(--gradient-3)') : 'transparent',
                color: form.type === t ? 'white' : 'var(--text-secondary)',
                textTransform: 'capitalize',
              }}>
                {t === 'income' ? '💰' : '💸'} {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <input
                type="number" className="form-input" placeholder="0.00" step="0.01" min="0.01"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text" className="form-input" placeholder="What was this for?"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
              <button type="button" className="btn btn-outline" onClick={suggestCategory} disabled={aiLoading} title="AI Auto-categorize" style={{ flexShrink: 0 }}>
                {aiLoading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <RiMagicLine size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Category</label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCategoryCreator(v => !v)} style={{ padding: '4px 8px' }}>
                <RiAddLine size={14} /> New
              </button>
            </div>
            <select className="form-select" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">— Select Category —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            {showCategoryCreator && (
              <div style={{ marginTop: 10, padding: 12, background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 10 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`New ${form.type} category name`}
                    value={newCategory.name}
                    onChange={e => setNewCategory(c => ({ ...c, name: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="form-input"
                    title="Type or paste any emoji icon"
                    value={newCategory.icon}
                    onChange={e => setNewCategory(c => ({ ...c, icon: e.target.value.slice(0, 4) }))}
                    style={{ width: 62, textAlign: 'center', fontSize: 20, padding: '6px 8px', flexShrink: 0 }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6, marginBottom: 10 }}>
                  {CATEGORY_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      title={icon}
                      onClick={() => setNewCategory(c => ({ ...c, icon }))}
                      style={{
                        height: 34, borderRadius: 8, border: '1px solid',
                        borderColor: newCategory.icon === icon ? 'var(--accent-blue)' : 'var(--border-light)',
                        background: newCategory.icon === icon ? 'var(--accent-blue-dim)' : 'var(--bg-card)',
                        cursor: 'pointer', fontSize: 17,
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCategoryCreator(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={createCategory} disabled={categorySaving}>
                    {categorySaving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : 'Create Category'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {['INR', 'USD', 'EUR', 'GBP', 'JPY'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Receipt Upload</label>
              <input type="file" className="form-input" accept="image/*,.pdf" style={{ paddingTop: 7 }}
                onChange={e => setReceipt(e.target.files[0])} />
            </div>
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="form-label">Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TAGS.map(tag => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{
                  padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid', transition: 'all 0.15s',
                  borderColor: form.tags.includes(tag) ? 'var(--accent-blue)' : 'var(--border-light)',
                  background: form.tags.includes(tag) ? 'var(--accent-blue-dim)' : 'transparent',
                  color: form.tags.includes(tag) ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-main)',
                }}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Recurring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 10 }}>
            <label className="toggle">
              <input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Recurring Transaction</span>
            {form.is_recurring && (
              <select className="form-select" style={{ marginLeft: 'auto', width: 'auto' }}
                value={form.recurring_interval} onChange={e => setForm(f => ({ ...f, recurring_interval: e.target.value }))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" placeholder="Additional notes..." rows={2}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className={`btn ${form.type === 'income' ? 'btn-success' : 'btn-danger'}`} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : (transaction ? 'Update' : 'Save Transaction')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

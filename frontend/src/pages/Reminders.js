import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate, today } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { RiAddLine, RiDeleteBinLine, RiCheckLine, RiBellLine, RiCloseLine, RiTimeLine } from 'react-icons/ri';

const TYPE_COLORS = {
  bill: { badge: 'badge-red', icon: '💡' },
  due_payment: { badge: 'badge-amber', icon: '💳' },
  recurring: { badge: 'badge-blue', icon: '🔄' },
  custom: { badge: 'badge-blue', icon: '📌' },
};

export default function Reminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', amount: '', type: 'custom' });
  const [saving, setSaving] = useState(false);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reminders');
      setReminders(res.data);
    } catch { toast.error('Failed to load reminders'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title || !form.due_date) { toast.error('Title and due date required'); return; }
    setSaving(true);
    try {
      await api.post('/reminders', form);
      toast.success('Reminder added!');
      setShowModal(false);
      setForm({ title: '', description: '', due_date: '', amount: '', type: 'custom' });
      fetchReminders();
    } catch { toast.error('Failed to add reminder'); }
    finally { setSaving(false); }
  };

  const handleComplete = async (id) => {
    await api.put(`/reminders/${id}/complete`);
    toast.success('Marked as done!');
    fetchReminders();
  };

  const handleDelete = async (id) => {
    await api.delete(`/reminders/${id}`);
    toast.success('Reminder deleted');
    fetchReminders();
  };

  const pending = reminders.filter(r => !r.is_completed);
  const completed = reminders.filter(r => r.is_completed);

  const getDaysUntil = (dueDate) => {
    const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `${Math.abs(diff)} days overdue`, color: 'var(--accent-red)' };
    if (diff === 0) return { label: 'Due today!', color: 'var(--accent-amber)' };
    if (diff <= 3) return { label: `Due in ${diff} day${diff > 1 ? 's' : ''}`, color: 'var(--accent-amber)' };
    return { label: `Due in ${diff} days`, color: 'var(--text-secondary)' };
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Reminders</h1>
          <p className="page-subtitle">Track bills, dues, and upcoming payments</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <RiAddLine size={16} /> Add Reminder
        </button>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Pending', value: pending.length, color: 'var(--accent-amber)' },
          { label: 'Overdue', value: pending.filter(r => new Date(r.due_date) < new Date()).length, color: 'var(--accent-red)' },
          { label: 'Completed', value: completed.length, color: 'var(--accent-green)' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending Reminders */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <RiBellLine size={18} color="var(--accent-amber)" />
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Pending Reminders ({pending.length})</h3>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner"></div></div>
        ) : pending.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">🎉</div>
            <h3>All caught up!</h3>
            <p>No pending reminders. Add one to stay on top of bills.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map(r => {
              const daysInfo = getDaysUntil(r.due_date);
              const typeInfo = TYPE_COLORS[r.type] || TYPE_COLORS.custom;
              const isOverdue = new Date(r.due_date) < new Date();
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px', borderRadius: 12,
                  background: isOverdue ? 'rgba(239,68,68,0.06)' : 'var(--bg-input)',
                  border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                  transition: 'all 0.2s',
                }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{typeInfo.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{r.title}</span>
                      <span className={`badge ${typeInfo.badge}`}>{r.type.replace('_', ' ')}</span>
                    </div>
                    {r.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{r.description}</div>}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RiTimeLine size={13} color="var(--text-muted)" />
                        <span style={{ color: daysInfo.color, fontWeight: 600 }}>{daysInfo.label}</span>
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📅 {formatDate(r.due_date)}</span>
                      {r.amount && (
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)' }}>
                          {formatCurrency(r.amount, user?.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-success btn-sm" onClick={() => handleComplete(r.id)} title="Mark complete">
                      <RiCheckLine size={15} /> Done
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }} onClick={() => handleDelete(r.id)} title="Delete">
                      <RiDeleteBinLine size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>
            ✅ Completed ({completed.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completed.map(r => (
              <div key={r.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderRadius: 10, opacity: 0.5,
                background: 'var(--bg-input)', border: '1px solid var(--border)',
              }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, textDecoration: 'line-through' }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{formatDate(r.due_date)}</span>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }} onClick={() => handleDelete(r.id)}>
                  <RiDeleteBinLine size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Reminder</h2>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}><RiCloseLine size={20} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="e.g. Electricity Bill" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="Optional details" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Due Date *</label>
                  <input type="date" className="form-input" value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} required min={today()} />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount</label>
                  <input type="number" className="form-input" placeholder="0.00" step="0.01" min="0"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="bill">💡 Bill</option>
                  <option value="due_payment">💳 Due Payment</option>
                  <option value="recurring">🔄 Recurring</option>
                  <option value="custom">📌 Custom</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Add Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

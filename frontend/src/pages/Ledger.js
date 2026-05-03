import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate, today } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { RiAddLine, RiUserLine, RiArrowUpLine, RiArrowDownLine, RiDeleteBinLine, RiCloseLine } from 'react-icons/ri';

export default function Ledger() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryType, setEntryType] = useState('given');

  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [entryForm, setEntryForm] = useState({ amount: '', date: today(), notes: '' });

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.get('/ledger/customers');
      setCustomers(res.data);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  }, []);

  const fetchLedger = useCallback(async (customerId) => {
    try {
      const res = await api.get(`/ledger/customers/${customerId}/entries`);
      setLedger(res.data);
    } catch { toast.error('Failed to load ledger'); }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { if (selected) fetchLedger(selected.id); }, [selected, fetchLedger]);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!customerForm.name) return;
    try {
      const res = await api.post('/ledger/customers', customerForm);
      toast.success('Customer added!');
      setCustomers(prev => [...prev, res.data]);
      setShowAddCustomer(false);
      setCustomerForm({ name: '', phone: '', email: '', address: '' });
    } catch { toast.error('Failed to add customer'); }
  };

  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('Delete this customer and all their entries?')) return;
    await api.delete(`/ledger/customers/${id}`);
    toast.success('Customer deleted');
    setCustomers(prev => prev.filter(c => c.id !== id));
    if (selected?.id === id) { setSelected(null); setLedger(null); }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!entryForm.amount || !selected) return;
    try {
      await api.post('/ledger/entries', {
        customer_id: selected.id,
        type: entryType,
        amount: entryForm.amount,
        date: entryForm.date,
        notes: entryForm.notes,
      });
      toast.success('Entry added!');
      setShowAddEntry(false);
      setEntryForm({ amount: '', date: today(), notes: '' });
      fetchLedger(selected.id);
      fetchCustomers();
    } catch { toast.error('Failed to add entry'); }
  };

  const handleDeleteEntry = async (id) => {
    await api.delete(`/ledger/entries/${id}`);
    toast.success('Entry deleted');
    fetchLedger(selected.id);
    fetchCustomers();
  };

  const totalBalance = customers.reduce((s, c) => s + parseFloat(c.balance || 0), 0);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">📒 Account Book</h1>
        <p className="page-subtitle">Track money given and received from customers (Khatabook style)</p>
      </div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Customers', value: customers.length },
          { label: 'Total Receivable', value: formatCurrency(customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0), user?.currency), color: 'var(--accent-green)' },
          { label: 'Total Payable', value: formatCurrency(Math.abs(customers.filter(c => c.balance < 0).reduce((s, c) => s + c.balance, 0)), user?.currency), color: 'var(--accent-red)' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color || 'var(--text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Customer List */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Customers</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddCustomer(true)}>
              <RiAddLine size={14} /> Add
            </button>
          </div>

          {loading ? <div className="loading-center"><div className="spinner"></div></div> :
            customers.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 30 }}>
                <RiUserLine size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No customers yet</p>
              </div>
            ) : (
              customers.map(c => (
                <div key={c.id}
                  onClick={() => setSelected(c)}
                  style={{
                    background: selected?.id === c.id ? 'var(--accent-blue-dim)' : 'var(--bg-card)',
                    border: `1px solid ${selected?.id === c.id ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '14px 16px', marginBottom: 8,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                      {c.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>📞 {c.phone}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                        color: c.balance > 0 ? 'var(--accent-green)' : c.balance < 0 ? 'var(--accent-red)' : 'var(--text-secondary)',
                      }}>
                        {c.balance > 0 ? '+' : ''}{formatCurrency(c.balance, user?.currency)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {c.balance > 0 ? 'to receive' : c.balance < 0 ? 'to pay' : 'settled'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          }
        </div>

        {/* Ledger View */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📒</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Select a Customer</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Choose a customer from the left to view their ledger</p>
            </div>
          ) : (
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800 }}>{selected.name}</h2>
                    {selected.phone && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>📞 {selected.phone}</p>}
                    {selected.email && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>✉️ {selected.email}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>NET BALANCE</div>
                    <div style={{
                      fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)',
                      color: ledger?.balance > 0 ? 'var(--accent-green)' : ledger?.balance < 0 ? 'var(--accent-red)' : 'var(--text-secondary)',
                    }}>
                      {ledger?.balance > 0 ? '+' : ''}{formatCurrency(ledger?.balance || 0, user?.currency)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {ledger?.balance > 0 ? '↑ Will receive' : ledger?.balance < 0 ? '↓ Need to pay' : '✓ Settled'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn btn-success btn-sm" onClick={() => { setEntryType('received'); setShowAddEntry(true); }}>
                    <RiArrowDownLine size={14} /> Money Received
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => { setEntryType('given'); setShowAddEntry(true); }}>
                    <RiArrowUpLine size={14} /> Money Given
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--accent-red)' }} onClick={() => handleDeleteCustomer(selected.id)}>
                    <RiDeleteBinLine size={14} /> Delete Customer
                  </button>
                </div>
              </div>

              {/* Entries */}
              <div className="card" style={{ padding: 0 }}>
                {!ledger || ledger.entries.length === 0 ? (
                  <div className="empty-state" style={{ padding: 40 }}>
                    <div className="empty-state-icon">📝</div>
                    <h3>No entries yet</h3>
                    <p>Record the first transaction with {selected.name}</p>
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Notes</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.entries.map(entry => (
                        <tr key={entry.id}>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(entry.date)}</td>
                          <td>
                            <span className={`badge ${entry.type === 'received' ? 'badge-green' : 'badge-red'}`}>
                              {entry.type === 'received' ? <RiArrowDownLine size={10} /> : <RiArrowUpLine size={10} />}
                              {entry.type === 'received' ? 'Received' : 'Given'}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14,
                              color: entry.type === 'received' ? 'var(--accent-green)' : 'var(--accent-red)',
                            }}>
                              {entry.type === 'received' ? '+' : '-'}{formatCurrency(entry.amount, user?.currency)}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{entry.notes || '—'}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }} onClick={() => handleDeleteEntry(entry.id)}>
                              <RiDeleteBinLine size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddCustomer(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Customer</h2>
              <button className="btn btn-ghost" onClick={() => setShowAddCustomer(false)}><RiCloseLine size={20} /></button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={customerForm.phone} onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={customerForm.email} onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-textarea" rows={2} value={customerForm.address} onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddCustomer(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddEntry(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: entryType === 'received' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {entryType === 'received' ? '💚 Money Received' : '❤️ Money Given'}
              </h2>
              <button className="btn btn-ghost" onClick={() => setShowAddEntry(false)}><RiCloseLine size={20} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              {entryType === 'received' ? `${selected?.name} paid you` : `You gave money to ${selected?.name}`}
            </p>
            <form onSubmit={handleAddEntry}>
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input type="number" className="form-input" placeholder="0.00" step="0.01" min="0.01"
                  value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} placeholder="What was this for?" value={entryForm.notes} onChange={e => setEntryForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddEntry(false)}>Cancel</button>
                <button type="submit" className={`btn ${entryType === 'received' ? 'btn-success' : 'btn-danger'}`}>
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

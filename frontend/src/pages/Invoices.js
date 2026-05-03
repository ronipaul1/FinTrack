import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { RiAddLine, RiDownloadLine, RiEditLine, RiDeleteBinLine, RiSearchLine, RiEyeLine, RiWhatsappLine } from 'react-icons/ri';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const STATUS_COLORS = { draft: 'badge-blue', sent: 'badge-amber', paid: 'badge-green', overdue: 'badge-red' };
const TEMPLATE = {
  ink: [15, 23, 42],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  cream: [255, 251, 235],
  mint: [220, 252, 231],
  green: [22, 163, 74],
  coral: [244, 114, 92],
  navy: [15, 23, 42],
};

const emptyItem = () => ({ description: '', quantity: 1, rate: '', amount: 0 });
const getItems = (items) => (typeof items === 'string' ? JSON.parse(items) : items) || [];
const buildWhatsAppInvoiceMessage = (inv, user) => {
  const lines = [
    `Invoice ${inv.invoice_number}`,
    `From: ${user?.name || 'Your Company'}`,
    `Bill to: ${inv.client_name}`,
    `Amount: ${formatCurrency(inv.total, inv.currency)}`,
    inv.due_date ? `Due date: ${formatDate(inv.due_date)}` : null,
    `Status: ${inv.status.toUpperCase()}`,
    inv.notes ? `Notes: ${inv.notes}` : null,
    '',
    'Please review this invoice and let me know if you have any questions.',
  ];

  return lines.filter(line => line !== null).join('\n');
};

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editInv, setEditInv] = useState(null);
  const [viewInv, setViewInv] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/invoices?${params}`);
      setInvoices(res.data);
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    await api.delete(`/invoices/${id}`);
    toast.success('Invoice deleted');
    fetchInvoices();
  };

  const createInvoicePDF = (inv) => {
    const doc = new jsPDF();
    const items = getItems(inv.items);

    doc.setFillColor(...TEMPLATE.cream);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setFillColor(...TEMPLATE.mint);
    doc.roundedRect(132, 12, 62, 38, 5, 5, 'F');
    doc.setFillColor(...TEMPLATE.coral);
    doc.circle(28, 28, 11, 'F');
    doc.setTextColor(...TEMPLATE.navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(33);
    doc.text('Invoice', 20, 66);
    doc.setFontSize(10);
    doc.setTextColor(...TEMPLATE.muted);
    doc.text(`No. ${inv.invoice_number}`, 22, 76);

    doc.setTextColor(...TEMPLATE.navy);
    doc.setFontSize(11);
    doc.text(user?.name || 'Your Company', 190, 24, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (user?.email) doc.text(user.email, 190, 31, { align: 'right' });
    if (inv.gst_number) doc.text(`GST ${inv.gst_number}`, 190, 38, { align: 'right' });

    doc.setDrawColor(...TEMPLATE.line);
    doc.line(20, 88, 190, 88);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TEMPLATE.green);
    doc.text('BILL TO', 20, 103);
    doc.text('DETAILS', 122, 103);
    doc.setTextColor(...TEMPLATE.navy);
    doc.setFontSize(12);
    doc.text(inv.client_name, 20, 113);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const clientLines = [
      inv.client_email,
      inv.client_phone,
      ...(inv.client_address ? doc.splitTextToSize(inv.client_address, 72) : []),
    ].filter(Boolean);
    if (clientLines.length) doc.text(clientLines, 20, 121);

    const details = [
      ['Invoice date', formatDate(inv.created_at)],
      ['Due date', inv.due_date ? formatDate(inv.due_date) : 'N/A'],
      ['Status', inv.status.toUpperCase()],
    ];
    details.forEach(([label, value], index) => {
      const y = 113 + index * 9;
      doc.setTextColor(...TEMPLATE.muted);
      doc.text(label, 122, y);
      doc.setTextColor(...TEMPLATE.navy);
      doc.setFont('helvetica', 'bold');
      doc.text(value, 190, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    });

    doc.autoTable({
      startY: 148,
      head: [['Item', 'Qty', 'Rate', 'Amount']],
      body: items.map((item) => [
        item.description || 'Line item',
        item.quantity,
        formatCurrency(item.rate, inv.currency),
        formatCurrency(item.quantity * item.rate, inv.currency),
      ]),
      margin: { left: 20, right: 20 },
      headStyles: { fillColor: TEMPLATE.navy, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: TEMPLATE.ink, fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 4, lineColor: TEMPLATE.line, lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 84 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 34, halign: 'right' },
        3: { cellWidth: 34, halign: 'right', fontStyle: 'bold' },
      },
    });

    const finalY = doc.lastAutoTable.finalY + 12;
    const panelX = 118;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(panelX, finalY - 4, 72, 39, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...TEMPLATE.muted);
    doc.text('Subtotal', panelX + 6, finalY + 5);
    doc.text(formatCurrency(inv.subtotal, inv.currency), 184, finalY + 5, { align: 'right' });
    if (parseFloat(inv.tax_rate) > 0) {
      doc.text(`GST (${inv.tax_rate}%)`, panelX + 6, finalY + 14);
      doc.text(formatCurrency(inv.tax_amount, inv.currency), 184, finalY + 14, { align: 'right' });
    }
    doc.setFillColor(...TEMPLATE.green);
    doc.roundedRect(panelX + 4, finalY + 20, 64, 12, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Total', panelX + 9, finalY + 28);
    doc.text(formatCurrency(inv.total, inv.currency), 184, finalY + 28, { align: 'right' });

    if (inv.notes) {
      doc.setTextColor(...TEMPLATE.navy);
      doc.setFontSize(9);
      doc.text('Notes', 20, finalY + 2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEMPLATE.muted);
      doc.text(doc.splitTextToSize(inv.notes, 82), 20, finalY + 10);
    }

    doc.setTextColor(...TEMPLATE.muted);
    doc.setFontSize(9);
    doc.text('Thank you for your business.', 105, 282, { align: 'center' });
    return doc;
  };

  const downloadPDF = (inv) => {
    const doc = createInvoicePDF(inv);
    doc.save(`${inv.invoice_number}.pdf`);
  };

  const shareOnWhatsApp = (inv) => {
    const message = buildWhatsAppInvoiceMessage(inv, user);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.total), 0),
    pending: invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + parseFloat(i.total), 0),
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Manage and track your invoices</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditInv(null); setShowModal(true); }}>
          <RiAddLine size={16} /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Invoices', value: stats.total, mono: false },
          { label: 'Amount Paid', value: formatCurrency(stats.paid, user?.currency), color: 'var(--accent-green)' },
          { label: 'Pending Amount', value: formatCurrency(stats.pending, user?.currency), color: 'var(--accent-amber)' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <RiSearchLine size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="form-input" style={{ paddingLeft: 36 }} placeholder="Search invoices..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Invoice List */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? <div className="loading-center"><div className="spinner"></div></div> :
         invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <h3>No invoices yet</h3>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setEditInv(null); setShowModal(true); }}>
              <RiAddLine size={16} /> Create First Invoice
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => setViewInv(inv)}>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--accent-blue)' }}>{inv.invoice_number}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.client_name}</div>
                    {inv.client_email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.client_email}</div>}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(inv.created_at)}</td>
                  <td style={{ fontSize: 13, color: inv.status === 'overdue' ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                    {inv.due_date ? formatDate(inv.due_date) : '—'}
                  </td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatCurrency(inv.total, inv.currency)}</span></td>
                  <td><span className={`badge ${STATUS_COLORS[inv.status] || 'badge-blue'}`}>{inv.status}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" title="Preview" onClick={() => setViewInv(inv)}><RiEyeLine size={15} /></button>
                      <button className="btn btn-ghost btn-sm" title="Download PDF" onClick={() => downloadPDF(inv)}><RiDownloadLine size={15} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-green)' }} title="Share on WhatsApp" onClick={() => shareOnWhatsApp(inv)}><RiWhatsappLine size={15} /></button>
                      <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => { setEditInv(inv); setShowModal(true); }}><RiEditLine size={15} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }} title="Delete" onClick={() => handleDelete(inv.id)}><RiDeleteBinLine size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <InvoiceModal invoice={editInv} onClose={() => { setShowModal(false); setEditInv(null); }} onSave={() => { setShowModal(false); setEditInv(null); fetchInvoices(); }} />}
      {viewInv && <InvoiceViewModal invoice={viewInv} user={user} onClose={() => setViewInv(null)} onDownload={downloadPDF} onShareWhatsApp={shareOnWhatsApp} />}
    </div>
  );
}

function InvoiceModal({ invoice, onClose, onSave }) {
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '', client_address: '',
    items: [emptyItem()], tax_rate: 0, due_date: '', notes: '', gst_number: '', currency: 'INR', status: 'draft',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (invoice) {
      setForm({
        client_name: invoice.client_name || '',
        client_email: invoice.client_email || '',
        client_phone: invoice.client_phone || '',
        client_address: invoice.client_address || '',
        items: (typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items) || [emptyItem()],
        tax_rate: invoice.tax_rate || 0,
        due_date: invoice.due_date ? invoice.due_date.split('T')[0] : '',
        notes: invoice.notes || '',
        gst_number: invoice.gst_number || '',
        currency: invoice.currency || 'INR',
        status: invoice.status || 'draft',
      });
    }
  }, [invoice]);

  const updateItem = (i, key, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [key]: val };
    if (key === 'quantity' || key === 'rate') {
      items[i].amount = (parseFloat(items[i].quantity) || 0) * (parseFloat(items[i].rate) || 0);
    }
    setForm(f => ({ ...f, items }));
  };

  const subtotal = form.items.reduce((s, item) => s + ((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)), 0);
  const taxAmount = subtotal * ((parseFloat(form.tax_rate) || 0) / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client_name) { toast.error('Client name required'); return; }
    setLoading(true);
    try {
      if (invoice) await api.put(`/invoices/${invoice.id}`, { ...form });
      else await api.post('/invoices', { ...form });
      toast.success(invoice ? 'Invoice updated!' : 'Invoice created!');
      onSave();
    } catch { toast.error('Failed to save invoice'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{invoice ? 'Edit Invoice' : 'New Invoice'}</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input className="form-input" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Client Email</label>
              <input className="form-input" type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Client Phone</label>
              <input className="form-input" value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input className="form-input" value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Client Address</label>
            <textarea className="form-textarea" rows={2} value={form.client_address} onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))} />
          </div>

          {/* Items */}
          <label className="form-label" style={{ marginBottom: 10 }}>Line Items</label>
          {form.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input className="form-input" placeholder="Description" style={{ flex: 2 }} value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
              <input className="form-input" type="number" placeholder="Qty" style={{ width: 70 }} value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
              <input className="form-input" type="number" placeholder="Rate" style={{ width: 100 }} value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} />
              <div style={{ width: 100, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', flexShrink: 0, textAlign: 'right' }}>
                {formatCurrency(item.amount, form.currency)}
              </div>
              {form.items.length > 1 && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }}
                  onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }))}>+ Add Item</button>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16 }}>
            <div className="grid-2">
              <div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">GST/Tax %</label>
                    <input className="form-input" type="number" min="0" max="100" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
              <div style={{ background: 'var(--bg-input)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatCurrency(subtotal, form.currency)}</span>
                </div>
                {form.tax_rate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>GST ({form.tax_rate}%)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatCurrency(taxAmount, form.currency)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(total, form.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : (invoice ? 'Update Invoice' : 'Create Invoice')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceViewModal({ invoice, user, onClose, onDownload, onShareWhatsApp }) {
  return <InvoiceCanvasModal invoice={invoice} user={user} onClose={onClose} onDownload={onDownload} onShareWhatsApp={onShareWhatsApp} />;
}

function InvoiceCanvasModal({ invoice, user, onClose, onDownload, onShareWhatsApp }) {
  const items = getItems(invoice.items);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl invoice-template-modal">
        <div className="modal-header">
          <h2 className="modal-title">Invoice {invoice.invoice_number}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-success btn-sm" onClick={() => onShareWhatsApp(invoice)}><RiWhatsappLine size={14} /> WhatsApp</button>
            <button className="btn btn-primary btn-sm" onClick={() => onDownload(invoice)}><RiDownloadLine size={14} /> Download PDF</button>
            <button className="btn btn-ghost" onClick={onClose}>x</button>
          </div>
        </div>
        <div className="canva-native-invoice">
          <header className="canva-native-top">
            <div className="canva-brand">
              <div className="canva-brand-mark">N</div>
              <div><strong>NEXTGEN</strong><span>DEV</span></div>
            </div>
            <div className="canva-top-bill">
              <strong>Billed to:</strong>
              <span>{invoice.client_name}</span>
              {invoice.client_address && <span>{invoice.client_address}</span>}
              {invoice.client_phone && <span>{invoice.client_phone}</span>}
            </div>
            <div className="canva-top-meta">
              <div><span>Invoice #</span><strong>{invoice.invoice_number}</strong></div>
              <div><span>Date:</span><strong>{formatDate(invoice.created_at)}</strong></div>
            </div>
          </header>

          <div className="canva-title-band">
            <h1>INVOICE</h1>
          </div>

          <main className="canva-native-body">
            <table className="canva-native-items">
              <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.description || 'Line item'}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.rate, invoice.currency)}</td>
                    <td>{formatCurrency(item.quantity * item.rate, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="canva-native-notes">
              {invoice.notes && (
                <>
                  <span>NOTES</span>
                  <p>{invoice.notes}</p>
                </>
              )}
              <div className="canva-native-footer-meta">
                <span>Due Date</span>
                <strong>{invoice.due_date ? formatDate(invoice.due_date) : 'N/A'}</strong>
                <span>Status</span>
                <strong>{invoice.status.toUpperCase()}</strong>
                {invoice.gst_number && (
                  <>
                    <span>GST</span>
                    <strong>{invoice.gst_number}</strong>
                  </>
                )}
              </div>
            </section>

            <section className="canva-native-total">
              <div><span>Subtotal</span><strong>{formatCurrency(invoice.subtotal, invoice.currency)}</strong></div>
              {parseFloat(invoice.tax_rate) > 0 && (
                <div><span>GST ({invoice.tax_rate}%)</span><strong>{formatCurrency(invoice.tax_amount, invoice.currency)}</strong></div>
              )}
              <div className="canva-native-total-row"><span>Total</span><strong>{formatCurrency(invoice.total, invoice.currency)}</strong></div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}


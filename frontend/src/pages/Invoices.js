import React, { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { formatCurrency, formatDate } from "../utils/format";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";
import {
  RiAddLine,
  RiDownloadLine,
  RiEditLine,
  RiDeleteBinLine,
  RiSearchLine,
  RiEyeLine,
  RiWhatsappLine,
} from "react-icons/ri";
import jsPDF from "jspdf";
import "jspdf-autotable";

const STATUS_COLORS = {
  draft: "badge-blue",
  sent: "badge-amber",
  paid: "badge-green",
  overdue: "badge-red",
};

const emptyItem = () => ({ description: "", quantity: 1, rate: "", amount: 0 });
const getItems = (items) =>
  (typeof items === "string" ? JSON.parse(items) : items) || [];
const buildWhatsAppInvoiceMessage = (inv, user) => {
  const lines = [
    `Invoice ${inv.invoice_number}`,
    `From: ${user?.name || "Your Company"}`,
    `Bill to: ${inv.client_name}`,
    `Amount: ${formatCurrency(inv.total, inv.currency)}`,
    inv.due_date ? `Due date: ${formatDate(inv.due_date)}` : null,
    `Status: ${inv.status.toUpperCase()}`,
    inv.notes ? `Notes: ${inv.notes}` : null,
    "",
    "Please review this invoice and let me know if you have any questions.",
  ];

  return lines.filter((line) => line !== null).join("\n");
};

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editInv, setEditInv] = useState(null);
  const [viewInv, setViewInv] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedInvoice, setExpandedInvoice] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get(`/invoices?${params}`);
      setInvoices(res.data);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this invoice?")) return;
    await api.delete(`/invoices/${id}`);
    toast.success("Invoice deleted");
    fetchInvoices();
  };
  //start of createInvoicePDF function
  const createInvoicePDF = (inv) => {
    const doc = new jsPDF();
    const items = getItems(inv.items);

    const BLACK = [20, 20, 20];
    const YELLOW = [255, 193, 7];
    const LIGHT_GRAY = [245, 245, 245];
    const GRAY = [100, 100, 100];
    const WHITE = [255, 255, 255];

    // Currency helper
    const pdfCurrency = (value) => {
      const amount = parseFloat(value) || 0;
      const currency = inv.currency || "INR";

      if (currency === "INR") {
        return `Rs. ${amount.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }

      return formatCurrency(value, currency);
    };

    // =========================
    // PAGE BACKGROUND
    // =========================

    doc.setFillColor(...WHITE);
    doc.rect(0, 0, 210, 297, "F");

    // =========================
    // HEADER
    // =========================

    doc.setFillColor(...BLACK);
    doc.rect(0, 0, 210, 48, "F");

    doc.setFillColor(...YELLOW);
    doc.rect(0, 0, 12, 48, "F");

    // Company
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(user?.name || "Your Company", 22, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    if (user?.email) {
      doc.text(user.email, 22, 28);
    }

    if (inv.gst_number) {
      doc.text(`GST: ${inv.gst_number}`, 22, 35);
    }

    // Invoice title
    doc.setTextColor(...YELLOW);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(27);
    doc.text("INVOICE", 190, 20, {
      align: "right",
    });

    doc.setTextColor(...WHITE);
    doc.setFontSize(10);
    doc.text(`# ${inv.invoice_number}`, 190, 30, {
      align: "right",
    });

    // =========================
    // BILL TO
    // =========================

    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("INVOICE TO", 20, 66);

    doc.setFillColor(...YELLOW);
    doc.rect(20, 69, 18, 1.5, "F");

    doc.setFontSize(13);
    doc.text(inv.client_name || "Client", 20, 79);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);

    let clientY = 86;

    if (inv.client_email) {
      doc.text(inv.client_email, 20, clientY);
      clientY += 6;
    }

    if (inv.client_phone) {
      doc.text(inv.client_phone, 20, clientY);
      clientY += 6;
    }

    if (inv.client_address) {
      const addressLines = doc.splitTextToSize(inv.client_address, 75);

      doc.text(addressLines, 20, clientY);
    }

    // =========================
    // INVOICE DETAILS
    // =========================

    const detailX = 125;
    const valueX = 190;

    const details = [
      ["Invoice No.", inv.invoice_number],
      ["Invoice Date", formatDate(inv.created_at)],
      ["Due Date", inv.due_date ? formatDate(inv.due_date) : "N/A"],
      ["Status", (inv.status || "draft").toUpperCase()],
    ];

    details.forEach(([label, value], index) => {
      const y = 68 + index * 9;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(label, detailX, y);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);
      doc.text(String(value), valueX, y, {
        align: "right",
      });
    });

    // =========================
    // ITEMS TABLE
    // =========================

    doc.autoTable({
      startY: 116,

      head: [["DESCRIPTION", "PRICE", "QTY", "TOTAL"]],

      body: items.map((item) => [
        item.description || "Line item",

        pdfCurrency(item.rate),

        item.quantity,

        pdfCurrency(
          (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0),
        ),
      ]),

      margin: {
        left: 20,
        right: 20,
      },

      theme: "plain",

      headStyles: {
        fillColor: BLACK,
        textColor: YELLOW,
        fontStyle: "bold",
        fontSize: 9,
        cellPadding: 5,
      },

      bodyStyles: {
        textColor: BLACK,
        fontSize: 9,
        cellPadding: 5,
      },

      alternateRowStyles: {
        fillColor: LIGHT_GRAY,
      },

      columnStyles: {
        0: {
          cellWidth: 75,
        },

        1: {
          cellWidth: 35,
          halign: "right",
        },

        2: {
          cellWidth: 20,
          halign: "center",
        },

        3: {
          cellWidth: 40,
          halign: "right",
          fillColor: [255, 235, 140],
          fontStyle: "bold",
        },
      },
    });

    // =========================
    // TOTALS
    // =========================

    const tableEnd = doc.lastAutoTable.finalY;

    const totalsY = tableEnd + 14;

    const totalX = 125;
    const amountX = 190;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);

    doc.text("SUBTOTAL", totalX, totalsY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLACK);

    doc.text(pdfCurrency(inv.subtotal), amountX, totalsY, {
      align: "right",
    });

    let grandTotalY = totalsY + 10;

    if (parseFloat(inv.tax_rate) > 0) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);

      doc.text(`GST (${inv.tax_rate}%)`, totalX, totalsY + 9);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLACK);

      doc.text(pdfCurrency(inv.tax_amount), amountX, totalsY + 9, {
        align: "right",
      });

      grandTotalY = totalsY + 18;
    }

    // =========================
    // GRAND TOTAL
    // =========================

    doc.setFillColor(...YELLOW);

    doc.rect(115, grandTotalY, 75, 15, "F");

    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);

    doc.text("GRAND TOTAL", 120, grandTotalY + 10);

    doc.text(pdfCurrency(inv.total), 185, grandTotalY + 10, {
      align: "right",
    });

    // =========================
    // NOTES
    // =========================

    if (inv.notes) {
      doc.setTextColor(...BLACK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);

      doc.text("NOTES", 20, tableEnd + 14);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);

      const noteLines = doc.splitTextToSize(inv.notes, 75);

      doc.text(noteLines, 20, tableEnd + 22);
    }

    // =========================
    // FOOTER
    // =========================

    // Main black footer
    doc.setFillColor(...BLACK);
    doc.rect(0, 277, 210, 20, "F");

    // Yellow payment section
    doc.setFillColor(...YELLOW);
    doc.rect(0, 277, 55, 20, "F");

    // =================================
    // LEFT — PAYMENT STATUS
    // =================================

    // Payment icon circle
    doc.setFillColor(...BLACK);
    doc.circle(13, 287, 4.5, "F");

    // Payment card
    doc.setFillColor(...YELLOW);
    doc.roundedRect(9.5, 284.5, 7, 5, 0.8, 0.8, "F");

    // Card stripe
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.line(10.5, 286, 15.5, 286);

    // Small check mark
    doc.line(13, 287.5, 14, 288.5);
    doc.line(14, 288.5, 16, 286.5);

    // Payment heading
    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);

    doc.text("PAYMENT STATUS", 20, 284);

    // Status badge
    doc.setFillColor(...BLACK);
    doc.roundedRect(20, 286, 18, 6, 2, 2, "F");

    doc.setTextColor(...YELLOW);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);

    doc.text((inv.status || "DRAFT").toUpperCase(), 29, 290, {
      align: "center",
    });

    // =================================
    // CENTER — COMPANY INFORMATION
    // =================================

    doc.setTextColor(...YELLOW);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    doc.text(user?.name || "Your Company", 88, 284, { align: "center" });

    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    doc.text(user?.email || "", 88, 290, { align: "center" });

    // Divider
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);

    doc.line(117, 280, 117, 294);

    // =================================
    // RIGHT — THANK YOU
    // =================================

    // Draw heart icon manually
    doc.setDrawColor(...YELLOW);
    doc.setLineWidth(0.7);

    doc.lines(
      [
        [1.8, -2.2],
        [3.2, 0],
        [1.8, 2.2],
        [-1.8, 4.2],
        [-1.8, -4.2],
        [-3.2, 0],
        [-1.8, -2.2],
      ],
      132,
      285,
      [1, 1],
      "S",
    );

    // Thank-you heading
    doc.setTextColor(...YELLOW);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);

    doc.text("Thank you for your business!", 141, 285);

    // Generated invoice text
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    doc.text("This is a computer-generated invoice.", 141, 291);

    return doc;
  };
  //end createInvoicePDF

  const downloadPDF = (inv) => {
    const doc = createInvoicePDF(inv);
    doc.save(`${inv.invoice_number}.pdf`);
  };

  const shareOnWhatsApp = (inv) => {
    const message = buildWhatsAppInvoiceMessage(inv, user);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const stats = {
    total: invoices.length,
    paid: invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + parseFloat(i.total), 0),
    pending: invoices
      .filter((i) => i.status !== "paid")
      .reduce((s, i) => s + parseFloat(i.total), 0),
  };

  return (
    <div className="fade-in">
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Manage and track your invoices</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditInv(null);
            setShowModal(true);
          }}
        >
          <RiAddLine size={16} /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: "Total Invoices", value: stats.total, mono: false },
          {
            label: "Amount Paid",
            value: formatCurrency(stats.paid, user?.currency),
            color: "var(--accent-green)",
          },
          {
            label: "Pending Amount",
            value: formatCurrency(stats.pending, user?.currency),
            color: "var(--accent-amber)",
          },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="card invoice-filters"
        style={{ marginBottom: 20, padding: "16px 20px" }}
      >
        <div className="invoice-filters-row">
          <div className="invoice-filters-search">
            <RiSearchLine
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 36 }}
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
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
        {loading ? (
          <div className="loading-center">
            <div className="spinner"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <h3>No invoices yet</h3>
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => {
                setEditInv(null);
                setShowModal(true);
              }}
            >
              <RiAddLine size={16} /> Create First Invoice
            </button>
          </div>
        ) : (
          <div className="invoice-table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th className="invoice-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setViewInv(inv)}
                  >
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          fontSize: 13,
                          color: "var(--accent-blue)",
                        }}
                      >
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.client_name}</div>
                      {inv.client_email && (
                        <div
                          style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                          {inv.client_email}
                        </div>
                      )}
                    </td>
                    <td
                      style={{ fontSize: 13, color: "var(--text-secondary)" }}
                    >
                      {formatDate(inv.created_at)}
                    </td>
                    <td
                      style={{
                        fontSize: 13,
                        color:
                          inv.status === "overdue"
                            ? "var(--accent-red)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {inv.due_date ? formatDate(inv.due_date) : "—"}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                        }}
                      >
                        {formatCurrency(inv.total, inv.currency)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${STATUS_COLORS[inv.status] || "badge-blue"}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td
                      className="invoice-actions-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="invoice-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Preview"
                          onClick={() => setViewInv(inv)}
                        >
                          <RiEyeLine size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Download PDF"
                          onClick={() => downloadPDF(inv)}
                        >
                          <RiDownloadLine size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--accent-green)" }}
                          title="Share on WhatsApp"
                          onClick={() => shareOnWhatsApp(inv)}
                        >
                          <RiWhatsappLine size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Edit"
                          onClick={() => {
                            setEditInv(inv);
                            setShowModal(true);
                          }}
                        >
                          <RiEditLine size={15} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--accent-red)" }}
                          title="Delete"
                          onClick={() => handleDelete(inv.id)}
                        >
                          <RiDeleteBinLine size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Mobile Invoice List */}
      <div className="mobile-invoice-list">
        {invoices.map((inv) => {
          const isExpanded =
            expandedInvoice !== null && expandedInvoice === inv.id;

          return (
            <div
              key={inv.id}
              className={`mobile-invoice-item ${isExpanded ? "expanded" : ""}`}
            >
              {/* Always visible */}
              <div className="mobile-invoice-summary">
                <button
                  type="button"
                  className="mobile-invoice-info"
                  onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                >
                  <span className="mobile-invoice-number">
                    {inv.invoice_number}
                  </span>

                  <span className="mobile-invoice-client">
                    {inv.client_name || "Unknown Client"}
                  </span>
                </button>

                <div className="mobile-invoice-summary-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Preview"
                    onClick={() => setViewInv(inv)}
                  >
                    <RiEyeLine size={17} />
                  </button>

                  <button
                    type="button"
                    className="mobile-invoice-expand"
                    onClick={() =>
                      setExpandedInvoice(isExpanded ? null : inv.id)
                    }
                    aria-label={
                      isExpanded ? "Collapse invoice" : "Expand invoice"
                    }
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>
              </div>

              {/* Hidden until expanded */}
              {isExpanded && (
                <div className="mobile-invoice-details">
                  <div className="mobile-invoice-detail-row">
                    <span>Invoice Date</span>
                    <strong>{formatDate(inv.created_at)}</strong>
                  </div>

                  <div className="mobile-invoice-detail-row">
                    <span>Due Date</span>
                    <strong>
                      {inv.due_date ? formatDate(inv.due_date) : "—"}
                    </strong>
                  </div>

                  <div className="mobile-invoice-detail-row">
                    <span>Amount</span>
                    <strong>{formatCurrency(inv.total, inv.currency)}</strong>
                  </div>

                  <div className="mobile-invoice-detail-row">
                    <span>Status</span>
                    <span
                      className={`badge ${
                        STATUS_COLORS[inv.status] || "badge-blue"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>

                  <div className="mobile-invoice-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditInv(inv);
                        setShowModal(true);
                      }}
                    >
                      <RiEditLine size={15} />
                      Edit
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => downloadPDF(inv)}
                    >
                      <RiDownloadLine size={15} />
                      Download
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--accent-green)" }}
                      onClick={() => shareOnWhatsApp(inv)}
                    >
                      <RiWhatsappLine size={15} />
                      WhatsApp
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--accent-red)" }}
                      onClick={() => handleDelete(inv.id)}
                    >
                      <RiDeleteBinLine size={15} />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <InvoiceModal
          invoice={editInv}
          onClose={() => {
            setShowModal(false);
            setEditInv(null);
          }}
          onSave={() => {
            setShowModal(false);
            setEditInv(null);
            fetchInvoices();
          }}
        />
      )}
      {viewInv && (
        <InvoiceViewModal
          invoice={viewInv}
          user={user}
          onClose={() => setViewInv(null)}
          onDownload={downloadPDF}
          onShareWhatsApp={shareOnWhatsApp}
        />
      )}
    </div>
  );
}

function InvoiceModal({ invoice, onClose, onSave }) {
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    client_address: "",
    items: [emptyItem()],
    tax_rate: 0,
    due_date: "",
    notes: "",
    gst_number: "",
    currency: "INR",
    status: "draft",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (invoice) {
      setForm({
        client_name: invoice.client_name || "",
        client_email: invoice.client_email || "",
        client_phone: invoice.client_phone || "",
        client_address: invoice.client_address || "",
        items: (typeof invoice.items === "string"
          ? JSON.parse(invoice.items)
          : invoice.items) || [emptyItem()],
        tax_rate: invoice.tax_rate || 0,
        due_date: invoice.due_date ? invoice.due_date.split("T")[0] : "",
        notes: invoice.notes || "",
        gst_number: invoice.gst_number || "",
        currency: invoice.currency || "INR",
        status: invoice.status || "draft",
      });
    }
  }, [invoice]);

  const updateItem = (i, key, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [key]: val };
    if (key === "quantity" || key === "rate") {
      items[i].amount =
        (parseFloat(items[i].quantity) || 0) * (parseFloat(items[i].rate) || 0);
    }
    setForm((f) => ({ ...f, items }));
  };

  const subtotal = form.items.reduce(
    (s, item) =>
      s + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0),
    0,
  );
  const taxAmount = subtotal * ((parseFloat(form.tax_rate) || 0) / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client_name) {
      toast.error("Client name required");
      return;
    }
    setLoading(true);
    try {
      if (invoice) await api.put(`/invoices/${invoice.id}`, { ...form });
      else await api.post("/invoices", { ...form });
      toast.success(invoice ? "Invoice updated!" : "Invoice created!");
      onSave();
    } catch {
      toast.error("Failed to save invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">
            {invoice ? "Edit Invoice" : "New Invoice"}
          </h2>
          <button
            className="btn btn-outline btn-sm invoice-close-btn"
            onClick={onClose}
            title="Close Preview"
          >
            ✕ Close
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input
                className="form-input"
                value={form.client_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, client_name: e.target.value }))
                }
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Client Email</label>
              <input
                className="form-input"
                type="email"
                value={form.client_email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, client_email: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Client Phone</label>
              <input
                className="form-input"
                value={form.client_phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, client_phone: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input
                className="form-input"
                value={form.gst_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gst_number: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Client Address</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={form.client_address}
              onChange={(e) =>
                setForm((f) => ({ ...f, client_address: e.target.value }))
              }
            />
          </div>

          {/* Items */}
          <label className="form-label" style={{ marginBottom: 10 }}>
            Line Items
          </label>
          {form.items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 8,
                alignItems: "center",
              }}
            >
              <input
                className="form-input"
                placeholder="Description"
                style={{ flex: 2 }}
                value={item.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
              />
              <input
                className="form-input"
                type="number"
                placeholder="Qty"
                style={{ width: 70 }}
                value={item.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value)}
              />
              <input
                className="form-input"
                type="number"
                placeholder="Rate"
                style={{ width: 100 }}
                value={item.rate}
                onChange={(e) => updateItem(i, "rate", e.target.value)}
              />
              <div
                style={{
                  width: 100,
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--accent-green)",
                  flexShrink: 0,
                  textAlign: "right",
                }}
              >
                {formatCurrency(item.amount, form.currency)}
              </div>
              {form.items.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--accent-red)" }}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      items: f.items.filter((_, j) => j !== i),
                    }))
                  }
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))
            }
          >
            + Add Item
          </button>

          <div
            style={{
              borderTop: "1px solid var(--border)",
              marginTop: 20,
              paddingTop: 16,
            }}
          >
            <div className="grid-2">
              <div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">GST/Tax %</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      max="100"
                      value={form.tax_rate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, tax_rate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={form.due_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, due_date: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
              <div
                style={{
                  background: "var(--bg-input)",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    Subtotal
                  </span>
                  <span
                    style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}
                  >
                    {formatCurrency(subtotal, form.currency)}
                  </span>
                </div>
                {form.tax_rate > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      GST ({form.tax_rate}%)
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(taxAmount, form.currency)}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 18,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 800,
                      color: "var(--accent-green)",
                    }}
                  >
                    {formatCurrency(total, form.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span
                  className="spinner"
                  style={{ width: 16, height: 16, borderWidth: 2 }}
                />
              ) : invoice ? (
                "Update Invoice"
              ) : (
                "Create Invoice"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceViewModal({
  invoice,
  user,
  onClose,
  onDownload,
  onShareWhatsApp,
}) {
  const items = getItems(invoice.items);

  const previewCurrency = (value, currency) => {
    const amount = parseFloat(value) || 0;

    if (currency === "INR") {
      return `Rs ${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    return formatCurrency(value, currency);
  };

  return (
    <div
      className="modal-overlay invoice-preview-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal modal-xl invoice-template-modal">
        {/* Preview Header */}
        <div className="modal-header invoice-preview-header">
          <h2 className="modal-title">
            Invoice {invoice.invoice_number}
          </h2>

          <div className="invoice-preview-actions">
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => onShareWhatsApp(invoice)}
            >
              <RiWhatsappLine size={15} />
              WhatsApp
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onDownload(invoice)}
            >
              <RiDownloadLine size={15} />
              Download PDF
            </button>

            <button
              type="button"
              className="invoice-close-btn"
              onClick={onClose}
              title="Close Preview"
              aria-label="Close Preview"
            >
              ×
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <div className="invoice-preview-scroll">
          <div className="canva-native-invoice">

            {/* Invoice Header */}
            <header className="invoice-document-header">

              {/* User Name */}
              <div className="invoice-from">
                <div className="invoice-from-name">
                  {user?.name || "Your Name"}
                </div>

                {user?.email && (
                  <div className="invoice-from-email">
                    {user.email}
                  </div>
                )}
              </div>

              {/* Invoice Meta */}
              <div className="invoice-document-meta">
                <div>
                  <span>Invoice #</span>
                  <strong>{invoice.invoice_number}</strong>
                </div>

                <div>
                  <span>Date</span>
                  <strong>{formatDate(invoice.created_at)}</strong>
                </div>
              </div>
            </header>

            {/* Bill To */}
            <section className="invoice-bill-section">
              <div className="invoice-section-label">
                BILLED TO
              </div>

              <div className="invoice-client-name">
                {invoice.client_name || "Client"}
              </div>

              {invoice.client_address && (
                <div className="invoice-client-detail">
                  {invoice.client_address}
                </div>
              )}

              {invoice.client_phone && (
                <div className="invoice-client-detail">
                  {invoice.client_phone}
                </div>
              )}

              {invoice.client_email && (
                <div className="invoice-client-detail">
                  {invoice.client_email}
                </div>
              )}
            </section>

            {/* Invoice Title */}
            <div className="invoice-title">
              INVOICE
            </div>

            {/* Items */}
            <section className="invoice-items-section">
              <table className="invoice-preview-table">
                <colgroup>
                  <col style={{ width: "46%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>

                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.description || "Line item"}</td>

                      <td className="invoice-number-cell">
                        {item.quantity}
                      </td>

                      <td className="invoice-number-cell">
                        {previewCurrency(
                          item.rate,
                          invoice.currency
                        )}
                      </td>

                      <td className="invoice-number-cell">
                        {previewCurrency(
                          item.quantity * item.rate,
                          invoice.currency
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Bottom Information */}
            <section className="invoice-bottom-section">

              <div className="invoice-status-section">
                <div className="invoice-info-row">
                  <span>Due Date</span>
                  <strong>
                    {invoice.due_date
                      ? formatDate(invoice.due_date)
                      : "N/A"}
                  </strong>
                </div>

                <div className="invoice-info-row">
                  <span>Status</span>
                  <strong
                    className={`invoice-status invoice-status-${invoice.status}`}
                  >
                    {invoice.status.toUpperCase()}
                  </strong>
                </div>

                {invoice.gst_number && (
                  <div className="invoice-info-row">
                    <span>GST</span>
                    <strong>{invoice.gst_number}</strong>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="invoice-total-box">
                <div className="invoice-total-row">
                  <span>Subtotal</span>
                  <strong>
                    {previewCurrency(
                      invoice.subtotal,
                      invoice.currency
                    )}
                  </strong>
                </div>

                {parseFloat(invoice.tax_rate) > 0 && (
                  <div className="invoice-total-row">
                    <span>
                      GST ({invoice.tax_rate}%)
                    </span>

                    <strong>
                      {previewCurrency(
                        invoice.tax_amount,
                        invoice.currency
                      )}
                    </strong>
                  </div>
                )}

                <div className="invoice-grand-total">
                  <span>Total</span>

                  <strong>
                    {previewCurrency(
                      invoice.total,
                      invoice.currency
                    )}
                  </strong>
                </div>
              </div>
            </section>

            {/* Notes */}
            {invoice.notes && (
              <section className="invoice-notes-section">
                <strong>Notes</strong>
                <p>{invoice.notes}</p>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
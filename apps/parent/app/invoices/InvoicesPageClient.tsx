"use client";

import type { InvoiceWithLines } from "@manhaj/lib/queries/invoices";
import type { ParentChild } from "@manhaj/lib/queries/parents";
import { useActiveChild, ALL_CHILDREN_ID } from "@manhaj/lib/child";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAed(amount: number): string {
  return `AED ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtAedShort(amount: number): string {
  return `AED ${amount.toLocaleString("en-US")}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00Z");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_LINES = [
  { description: "Tuition (Term 3 portion)", note: "Grade 10 · 13 weeks", amount_aed: 6500 },
  { description: "Bus transport", note: "Route 8 · home–school return", amount_aed: 850 },
  { description: "Lunch programme", note: "Hot lunch · 5 days/week", amount_aed: 600 },
  { description: "Enrichment & field trips", note: "Includes Bait Al Zubair · 3 June", amount_aed: 450 },
  { description: "Books & stationery deposit", note: "Refundable at year end", amount_aed: 350 },
];

const MOCK_HISTORY = [
  { inv: "INV-2026-T3-02", desc: "Term 3 – Installment 2", paid: "15 Mar 2026", method: "Visa ****4521", amount: 8750 },
  { inv: "INV-2026-T3-01", desc: "Term 3 – Installment 1", paid: "15 Dec 2025", method: "Bank transfer",  amount: 8750 },
  { inv: "INV-2026-T2-04", desc: "Term 2 – Installment 4 (final)", paid: "15 Sep 2025", method: "Visa ****4521", amount: 8500 },
  { inv: "INV-2026-REG",   desc: "Registration & books",            paid: "5 Aug 2025",  method: "Bank transfer",  amount: 2400 },
];

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  dbInvoices: InvoiceWithLines[];
  dbChildren: ParentChild[];
}

export default function InvoicesPageClient({ dbInvoices, dbChildren }: Props) {
  const { activeId } = useActiveChild();
  const isMock = dbInvoices.length === 0;

  // ── Live mode ──────────────────────────────────────────────────────────────
  if (!isMock) {
    // Filter to active child
    const childInvoices = activeId === ALL_CHILDREN_ID
      ? dbInvoices
      : dbInvoices.filter(i => i.student_id === activeId);

    const unpaid = childInvoices
      .filter(i => i.status !== "paid" && i.status !== "cancelled")
      .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));

    const paid = childInvoices
      .filter(i => i.status === "paid")
      .sort((a, b) => (b.paid_on ?? "").localeCompare(a.paid_on ?? ""));

    const focused = unpaid[0] ?? childInvoices[0];

    const childInfo = dbChildren.find(c => c.student_id === focused?.student_id);
    const gradeLabel = childInfo?.grade_level ?? childInfo?.section_code ?? "";

    const total = focused ? focused.amount_owed_aed : 0;
    const days = daysUntil(focused?.due_on ?? null);

    // Breadcrumb label from what_for or invoice_number
    const invoiceLabel = focused?.what_for ?? focused?.invoice_number ?? "Invoice";

    if (!focused) {
      return (
        <div className="inv-root">
          <div className="inv-breadcrumb">
            <span>Home</span><span className="inv-bc-sep">›</span><span>Invoices</span>
          </div>
          <div className="inv-empty">
            <div className="inv-empty-icon">✅</div>
            <div className="inv-empty-title">All paid</div>
            <div className="inv-empty-sub">No outstanding invoices for this account.</div>
          </div>
        </div>
      );
    }

    return (
      <div className="inv-root">
        <div className="inv-breadcrumb">
          <span>Home</span><span className="inv-bc-sep">›</span>
          <span>Invoices</span><span className="inv-bc-sep">›</span>
          <span className="inv-bc-active">{invoiceLabel}</span>
        </div>
        <div className="inv-page-title">{focused.what_for ?? focused.invoice_number ?? "Invoice"}</div>
        <div className="inv-page-sub">
          For {focused.student_name ?? "—"}{gradeLabel ? ` · ${gradeLabel}` : ""} · Academic year 2025/26
        </div>

        <div className="inv-body">
          {/* ── Left column ── */}
          <div className="inv-left">
            {/* Hero */}
            <div className="inv-hero">
              <div className="inv-hero-left">
                <div className="inv-hero-label">AMOUNT DUE</div>
                <div className="inv-hero-amount">{fmtAed(total)}</div>
                <div className="inv-hero-ref">
                  {focused.invoice_number ?? "—"} · Issued {fmtDateShort(focused.issued_on)}
                </div>
              </div>
              <div className="inv-hero-right">
                <div className="inv-hero-label">DUE</div>
                <div className="inv-hero-due">{fmtDate(focused.due_on)}</div>
                {days !== null && (
                  <div className="inv-hero-days">
                    {days > 0 ? `${days} days from today` : days === 0 ? "Due today" : `${Math.abs(days)} days overdue`}
                  </div>
                )}
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="inv-card">
              <div className="inv-card-title">What this covers</div>
              <div className="inv-lines">
                {focused.lines.length > 0
                  ? focused.lines.map((line, i) => (
                    <div key={i} className="inv-line-row">
                      <div className="inv-line-name">{line.description}</div>
                      <div className="inv-line-amount">{fmtAed(line.amount_aed)}</div>
                    </div>
                  ))
                  : <div className="inv-line-empty">No line item breakdown available.</div>}
              </div>
              <div className="inv-lines-sep" />
              <div className="inv-line-row inv-line-total">
                <div className="inv-line-name">Total due</div>
                <div className="inv-line-amount">{fmtAed(total)}</div>
              </div>
            </div>

            {/* Payment history */}
            {paid.length > 0 && (
              <div className="inv-card">
                <div className="inv-card-title">Payment history</div>
                <div className="inv-hist-sub">Everything you&apos;ve paid this academic year.</div>
                <div className="inv-hist-wrap">
                  <table className="inv-hist-table">
                    <thead>
                      <tr>
                        <th>INVOICE</th><th>DESCRIPTION</th><th>PAID</th>
                        <th>STATUS</th><th>AMOUNT</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paid.map(inv => (
                        <tr key={inv.id}>
                          <td className="inv-hist-code">{inv.invoice_number ?? "—"}</td>
                          <td className="inv-hist-desc">{inv.what_for ?? "—"}</td>
                          <td className="inv-hist-date">{fmtDateShort(inv.paid_on)}</td>
                          <td><span className="inv-hist-badge">PAID</span></td>
                          <td className="inv-hist-amt">{fmtAedShort(inv.amount_owed_aed)}</td>
                          <td><button className="inv-hist-receipt">Receipt ↓</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="inv-right">
            <PayPanel amount={total} />
          </div>
        </div>
      </div>
    );
  }

  // ── Mock mode ──────────────────────────────────────────────────────────────
  const MOCK_AMOUNT = 8750;
  const MOCK_DUE = "2026-06-15";
  const MOCK_ISSUED = "2026-05-25";
  const MOCK_INV_NUM = "INV-2026-T3-03";
  const days = daysUntil(MOCK_DUE);

  return (
    <div className="inv-root">
      <div className="inv-breadcrumb">
        <span>Home</span><span className="inv-bc-sep">›</span>
        <span>Invoices</span><span className="inv-bc-sep">›</span>
        <span className="inv-bc-active">Term 3 · Installment 3</span>
      </div>
      <div className="inv-page-title">Term 3 fee — Installment 3 of 4</div>
      <div className="inv-page-sub">For Layla Al-Habsi · 10A · Academic year 2025/26</div>

      <div className="inv-body">
        {/* ── Left column ── */}
        <div className="inv-left">
          {/* Hero */}
          <div className="inv-hero">
            <div className="inv-hero-left">
              <div className="inv-hero-label">AMOUNT DUE</div>
              <div className="inv-hero-amount">{fmtAed(MOCK_AMOUNT)}</div>
              <div className="inv-hero-ref">{MOCK_INV_NUM} · Issued {fmtDateShort(MOCK_ISSUED)}</div>
            </div>
            <div className="inv-hero-right">
              <div className="inv-hero-label">DUE</div>
              <div className="inv-hero-due">{fmtDate(MOCK_DUE)}</div>
              {days !== null && (
                <div className="inv-hero-days">
                  {days > 0 ? `${days} days from today` : days === 0 ? "Due today" : `${Math.abs(days)} days overdue`}
                </div>
              )}
            </div>
          </div>

          {/* What this covers */}
          <div className="inv-card">
            <div className="inv-card-title">What this covers</div>
            <div className="inv-card-sub">Term 3 runs from 30 March to 27 June 2026.</div>
            <div className="inv-lines">
              {MOCK_LINES.map((line, i) => (
                <div key={i} className="inv-line-row">
                  <div>
                    <div className="inv-line-name">{line.description}</div>
                    <div className="inv-line-note">{line.note}</div>
                  </div>
                  <div className="inv-line-amount">{fmtAed(line.amount_aed)}</div>
                </div>
              ))}
            </div>
            <div className="inv-lines-sep" />
            <div className="inv-line-row inv-line-total">
              <div className="inv-line-name">Total due</div>
              <div className="inv-line-amount">{fmtAed(MOCK_AMOUNT)}</div>
            </div>
          </div>

          {/* Payment history */}
          <div className="inv-card">
            <div className="inv-card-title">Payment history</div>
            <div className="inv-hist-sub">Everything you&apos;ve paid this academic year.</div>
            <div className="inv-hist-wrap">
              <table className="inv-hist-table">
                <thead>
                  <tr>
                    <th>INVOICE</th><th>DESCRIPTION</th><th>PAID</th>
                    <th>METHOD</th><th>STATUS</th><th>AMOUNT</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_HISTORY.map((h, i) => (
                    <tr key={i}>
                      <td className="inv-hist-code">{h.inv}</td>
                      <td className="inv-hist-desc">{h.desc}</td>
                      <td className="inv-hist-date">{h.paid}</td>
                      <td className="inv-hist-method">{h.method}</td>
                      <td><span className="inv-hist-badge">PAID</span></td>
                      <td className="inv-hist-amt">AED {h.amount.toLocaleString()}</td>
                      <td><button className="inv-hist-receipt">Receipt ↓</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="inv-right">
          <PayPanel amount={MOCK_AMOUNT} />
        </div>
      </div>
    </div>
  );
}

// ── Payment panel ─────────────────────────────────────────────────────────────

function PayPanel({ amount }: { amount: number }) {
  return (
    <div className="inv-pay-card">
      <div className="inv-pay-title">Pay this invoice</div>
      <p className="inv-pay-desc">
        Payments are handled by the school&apos;s secure portal — you&apos;ll be redirected to complete payment there.
      </p>

      <div className="inv-pay-total-row">
        <span className="inv-pay-total-label">TOTAL</span>
        <span className="inv-pay-total-value">AED {amount.toLocaleString()}</span>
      </div>

      <div className="inv-portal-card">
        <div className="inv-portal-logo">ISO</div>
        <div>
          <div className="inv-portal-name">ISO Parent Portal</div>
          <div className="inv-portal-sub">Operated by International School of Oman</div>
        </div>
      </div>

      <ul className="inv-features">
        {[
          "Pay by card or bank transfer",
          "Set up installment plans (if your school offers them)",
          "Manage auto-pay for future invoices",
          "Download official receipts",
        ].map((f, i) => (
          <li key={i} className="inv-feature-item">
            <span className="inv-feature-check">✓</span>
            {f}
          </li>
        ))}
      </ul>

      <button className="inv-pay-btn inv-pay-btn--primary">
        Pay on ISO Parent Portal ↗
      </button>
      <button className="inv-pay-btn inv-pay-btn--outline">
        Download Invoice PDF ↓
      </button>

      <div className="inv-pay-next">
        <span className="inv-pay-next-arrow">→</span>
        <p>
          <b>What happens next:</b> we open the school&apos;s payment portal in a new tab.
          After you complete payment there, this invoice updates here within a few minutes.
        </p>
      </div>

      <p className="inv-pay-disclaimer">
        Manhaj never sees your card details. All payments stay with your school&apos;s chosen provider.
      </p>
    </div>
  );
}

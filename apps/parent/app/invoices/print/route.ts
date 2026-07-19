/**
 * Printable invoice / receipt — server-rendered HTML.
 *
 * GET /parent/invoices/print?invoice=<uuid>
 *
 * DB-first, demo-fallback (the standing "OR" pattern): looks the invoice up
 * in the signed-in parent's invoices; when there's no session / no match it
 * renders the demo invoice so the button is never dead.
 *
 * A standalone document (no app chrome) styled for A4 — "Download PDF" is
 * the browser's own print → Save as PDF. Paid invoices render as receipts.
 */

import { NextRequest } from "next/server";
import { getCurrentParentId } from "@manhaj/lib/queries/auth";
import { getInvoicesForParent, type InvoiceWithLines } from "@manhaj/lib/queries/invoices";

export const dynamic = "force-dynamic";

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";

const MOCK_INVOICE: InvoiceWithLines = {
  id: "demo",
  invoice_number: "INV-2026-T3-03",
  status: "unpaid",
  issued_on: "2026-05-25",
  due_on: "2026-06-15",
  paid_on: null,
  amount_owed_aed: 8750,
  what_for: "Term 3 fee — Installment 3 of 4",
  reference_code: null,
  notes: null,
  student_name: "Layla Al-Habsi",
  student_id: null,
  lines: [
    { id: "l1", description: "Tuition (Term 3 portion) — Grade 10 · 13 weeks", amount_aed: 6500, display_order: 1 },
    { id: "l2", description: "Bus transport — Route 8 · home–school return",   amount_aed: 850,  display_order: 2 },
    { id: "l3", description: "Lunch programme — Hot lunch · 5 days/week",      amount_aed: 600,  display_order: 3 },
    { id: "l4", description: "Enrichment & field trips",                        amount_aed: 450,  display_order: 4 },
    { id: "l5", description: "Books & stationery deposit (refundable)",         amount_aed: 350,  display_order: 5 },
  ],
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtAed(n: number): string {
  return `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

function renderHtml(inv: InvoiceWithLines, isDemo: boolean): string {
  const isPaid = inv.status === "paid";
  const title = isPaid ? "Receipt" : "Invoice";
  const lineRows = inv.lines.length > 0
    ? inv.lines.map(l => `
        <tr>
          <td>${esc(l.description)}</td>
          <td class="amt">${fmtAed(l.amount_aed)}</td>
        </tr>`).join("")
    : `<tr><td colspan="2" class="empty">No line-item breakdown available.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} ${esc(inv.invoice_number ?? "")} · Manhaji</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #EDF2F7; color: #1A202C; padding: 32px 16px;
  }
  .sheet {
    max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px;
    box-shadow: 0 4px 24px rgba(26,32,44,.10); padding: 48px 56px;
  }
  .toolbar { max-width: 720px; margin: 0 auto 16px; display: flex; justify-content: flex-end; gap: 8px; }
  .toolbar button {
    font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
    background: #1A365D; color: #fff; border: 0; border-radius: 8px; padding: 9px 18px;
  }
  .toolbar .hint { font-size: 11px; color: #718096; align-self: center; margin-right: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .brand { display: flex; gap: 10px; align-items: center; }
  .logo {
    width: 36px; height: 36px; border-radius: 9px; background: #1A365D; color: #fff;
    display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px;
  }
  .school { font-size: 14px; font-weight: 700; }
  .via { font-size: 10.5px; color: #718096; }
  .doc-type { text-align: right; }
  .doc-type h1 { font-size: 22px; letter-spacing: .08em; text-transform: uppercase; color: #1A365D; }
  .doc-num { font-size: 11.5px; color: #718096; margin-top: 2px; }
  .paid-stamp {
    display: inline-block; margin-top: 6px; padding: 3px 12px; border-radius: 9999px;
    background: #C6F6D5; color: #22543D; font-size: 11px; font-weight: 800; letter-spacing: .06em;
  }
  .demo-stamp {
    display: inline-block; margin-top: 6px; padding: 3px 12px; border-radius: 9999px;
    background: #FEFCBF; color: #744210; font-size: 11px; font-weight: 800; letter-spacing: .06em;
  }
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 28px;
          padding: 16px 20px; background: #F7FAFC; border-radius: 10px; }
  .meta div { font-size: 12.5px; }
  .meta .lbl { font-size: 10px; font-weight: 700; letter-spacing: .06em; color: #718096; text-transform: uppercase; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  thead th {
    text-align: left; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: #718096; padding: 0 0 8px; border-bottom: 2px solid #E2E8F0;
  }
  thead th.amt { text-align: right; }
  tbody td { font-size: 13px; padding: 10px 0; border-bottom: 1px solid #EDF2F7; }
  tbody td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  tbody td.empty { color: #718096; font-size: 12px; }
  .total-row { display: flex; justify-content: space-between; padding: 14px 0 0; font-weight: 800; font-size: 15px; }
  .total-row .l { letter-spacing: .02em; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #E2E8F0;
            font-size: 10.5px; color: #718096; line-height: 1.6; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; max-width: none; padding: 24px 8px; }
    .toolbar { display: none; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span class="hint">Use &ldquo;Save as PDF&rdquo; in the print dialog to download.</span>
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet">
    <div class="head">
      <div class="brand">
        <div class="logo">M</div>
        <div>
          <div class="school">${esc(SCHOOL_NAME)}</div>
          <div class="via">Issued via Manhaji · Academic year 2025/26</div>
        </div>
      </div>
      <div class="doc-type">
        <h1>${esc(title)}</h1>
        <div class="doc-num">${esc(inv.invoice_number ?? "—")}</div>
        ${isPaid ? `<span class="paid-stamp">PAID</span>` : ""}
        ${isDemo ? `<span class="demo-stamp">DEMO DATA</span>` : ""}
      </div>
    </div>

    <div class="meta">
      <div><div class="lbl">Student</div>${esc(inv.student_name ?? "—")}</div>
      <div><div class="lbl">Issued</div>${fmtDate(inv.issued_on)}</div>
      <div><div class="lbl">${isPaid ? "Paid on" : "Due"}</div>${fmtDate(isPaid ? inv.paid_on : inv.due_on)}</div>
    </div>

    ${inv.what_for ? `<div style="font-size:14px;font-weight:700;margin-bottom:14px;">${esc(inv.what_for)}</div>` : ""}

    <table>
      <thead><tr><th>Description</th><th class="amt">Amount</th></tr></thead>
      <tbody>${lineRows}</tbody>
    </table>
    <div class="total-row">
      <span class="l">${isPaid ? "Total paid" : "Total due"}</span>
      <span>${fmtAed(inv.amount_owed_aed)}</span>
    </div>

    <div class="footer">
      Payments are handled on the school&rsquo;s own portal — Manhaji never sees your card details.
      Questions about this ${title.toLowerCase()}? Contact the school finance office.
      ${inv.reference_code ? `Reference: ${esc(inv.reference_code)}.` : ""}
    </div>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const invoiceId = req.nextUrl.searchParams.get("invoice");

  let invoice: InvoiceWithLines | null = null;
  try {
    const parentId = await getCurrentParentId();
    if (parentId && invoiceId) {
      const invoices = await getInvoicesForParent(parentId);
      invoice = invoices.find(i => i.id === invoiceId) ?? null;
    }
  } catch {
    invoice = null;
  }

  const isDemo = invoice === null;
  const html = renderHtml(invoice ?? MOCK_INVOICE, isDemo);
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

"use client";

import type { InvoiceWithLines } from "@manhaj/lib/queries/invoices";
import { useActiveChild, ALL_CHILDREN_ID, getActiveChild } from "@manhaj/lib/child";
import {
  MOCK_INVOICES, householdSnapshot,
  type ChildInvoices, type Installment, type InstallmentStatus,
} from "@manhaj/lib/mock-invoices";
import { invoiceParentSummary } from "@manhaj/lib/summary";

import InvoiceAlert      from "./components/InvoiceAlert";
import BalanceHero       from "./components/BalanceHero";
import InstallmentCards  from "./components/InstallmentCards";
import FeeBreakdown      from "./components/FeeBreakdown";
import PaymentHistory    from "./components/PaymentHistory";
import HouseholdRows     from "./components/HouseholdRows";

function mapToChildInvoices(dbInvoices: InvoiceWithLines[]): ChildInvoices[] {
  const byStudent = new Map<string, InvoiceWithLines[]>();
  for (const inv of dbInvoices) {
    const sid = inv.student_id ?? "unknown";
    const list = byStudent.get(sid) ?? [];
    list.push(inv);
    byStudent.set(sid, list);
  }

  return Array.from(byStudent.entries()).map(([studentId, invoices]) => {
    const installments: Installment[] = invoices.map((inv, i) => {
      const termNum = Math.min(3, i + 1) as 1 | 2 | 3;
      const dbStatus: InstallmentStatus =
        inv.status === "paid" ? "paid" : inv.status === "partial" ? "partial" : "scheduled";
      const paid = inv.status === "paid" ? inv.amount_owed_aed : 0;
      return {
        id: inv.id,
        term: termNum,
        label: inv.what_for ?? inv.invoice_number ?? `Invoice ${i + 1}`,
        period: inv.issued_on
          ? new Date(inv.issued_on).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
          : "—",
        total: inv.amount_owed_aed,
        paid,
        due_date: inv.due_on ?? "",
        status: dbStatus,
        lines: inv.lines.map(l => ({
          label: l.description,
          category: "other" as const,
          amount: l.amount_aed,
          optional: false,
          status: "due" as const,
        })),
      };
    });

    const outstanding = installments
      .filter(i => i.status !== "paid")
      .reduce((sum, i) => sum + i.total - i.paid, 0);

    const nextDue = installments
      .filter(i => i.status !== "paid" && i.due_date)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0]?.due_date ?? "";

    return {
      child_id: studentId,
      child_name: invoices[0]?.student_name ?? "Student",
      outstanding,
      due_date: nextDue,
      installments,
      payments: [],
    };
  });
}

function firstName(fullName: string): string {
  return fullName.split(" ")[0];
}

export default function InvoicesPageClient({ dbInvoices }: { dbInvoices: InvoiceWithLines[] }) {
  const { activeId } = useActiveChild();
  const hasRealData  = dbInvoices.length > 0;

  if (hasRealData) {
    const childRows  = mapToChildInvoices(dbInvoices);
    const household  = householdSnapshot(childRows);
    const summary    = invoiceParentSummary(childRows, ALL_CHILDREN_ID, household);

    const allInstallments = childRows.flatMap(c =>
      c.installments.map(i => ({ ...i, label: `${i.label} · ${firstName(c.child_name)}` })),
    );
    const mostUrgent = allInstallments.find(i => i.status === "partial")
      ?? allInstallments.find(i => i.status === "scheduled")
      ?? allInstallments[0];

    return (
      <div className="container">
        <h1>Invoices</h1>
        <p className="sub">Household view · AY 2025–26</p>
        <InvoiceAlert summary={summary} />
        <BalanceHero mode="household" summary={summary} household={household} />
        <InstallmentCards rows={allInstallments} />
        {mostUrgent && <FeeBreakdown installment={mostUrgent} />}
        <PaymentHistory rows={[]} />
        <HouseholdRows rows={childRows} />
      </div>
    );
  }

  // Fall back to mock data
  const household = householdSnapshot(MOCK_INVOICES);
  const summary   = invoiceParentSummary(MOCK_INVOICES, activeId, household);

  if (activeId === ALL_CHILDREN_ID) {
    const allInstallments = MOCK_INVOICES.flatMap(c =>
      c.installments.map(i => ({ ...i, label: `${i.label} · ${firstName(c.child_name)}` })),
    );
    const allPayments = MOCK_INVOICES.flatMap(c =>
      c.payments.map(p => ({ ...p, for: `${p.for} · ${firstName(c.child_name)}` })),
    );
    const mostUrgent = allInstallments.find(i => i.status === "partial")
      ?? allInstallments.find(i => i.status === "scheduled")
      ?? allInstallments[0];

    return (
      <div className="container">
        <h1>Invoices</h1>
        <p className="sub">Household view · AY 2025–26</p>
        <InvoiceAlert summary={summary} />
        <BalanceHero mode="household" summary={summary} household={household} />
        <InstallmentCards rows={allInstallments} />
        <FeeBreakdown installment={mostUrgent} />
        <PaymentHistory rows={allPayments} />
        <HouseholdRows rows={MOCK_INVOICES} />
      </div>
    );
  }

  const child = getActiveChild(activeId);
  const row   = MOCK_INVOICES.find(r => r.child_id === activeId);

  if (!child || !row) {
    return (
      <div className="container">
        <h1>Invoices</h1>
        <p className="sub">No invoice data for this child.</p>
      </div>
    );
  }

  const focused = row.installments.find(i => i.status === "partial")
    ?? row.installments.find(i => i.status === "scheduled")
    ?? row.installments[0];

  return (
    <div className="container">
      <h1>Invoices · {row.child_name}</h1>
      <p className="sub">{child.grade_label} · AY 2025–26</p>
      <InvoiceAlert summary={summary} />
      <BalanceHero mode="single" summary={summary} child={row} />
      <InstallmentCards rows={row.installments} />
      <FeeBreakdown installment={focused} />
      <PaymentHistory rows={row.payments} />
    </div>
  );
}

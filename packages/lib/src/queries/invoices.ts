import { serverClient } from "../supabase";

export type InvoiceWithLines = {
  id: string;
  invoice_number: string | null;
  status: string;
  issued_on: string | null;
  due_on: string | null;
  paid_on: string | null;
  amount_owed_aed: number;
  what_for: string | null;
  reference_code: string | null;
  notes: string | null;
  student_name: string | null;
  student_id: string | null;
  lines: Array<{ id: string; description: string; amount_aed: number; display_order: number }>;
};

export async function getInvoicesForParent(parentId: string): Promise<InvoiceWithLines[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("invoices")
    .select(`
      id, invoice_number, status, issued_on, due_on, paid_on,
      amount_owed_aed, what_for, reference_code, notes, student_id,
      students ( full_name_en ),
      invoice_lines ( id, description, amount_aed, display_order )
    `)
    .eq("parent_id", parentId)
    .order("issued_on", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map(inv => {
    const stu = inv.students as { full_name_en: string } | null;
    const lines = (inv.invoice_lines as Array<{ id: string; description: string; amount_aed: number; display_order: number }> | null) ?? [];
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      status: inv.status,
      issued_on: inv.issued_on,
      due_on: inv.due_on,
      paid_on: inv.paid_on,
      amount_owed_aed: Number(inv.amount_owed_aed),
      what_for: inv.what_for,
      reference_code: inv.reference_code,
      notes: inv.notes,
      student_id: inv.student_id,
      student_name: stu?.full_name_en ?? null,
      lines: lines.sort((a, b) => a.display_order - b.display_order),
    };
  });
}

export async function getInvoicesForStudent(studentId: string): Promise<InvoiceWithLines[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("invoices")
    .select(`
      id, invoice_number, status, issued_on, due_on, paid_on,
      amount_owed_aed, what_for, reference_code, notes, student_id,
      students ( full_name_en ),
      invoice_lines ( id, description, amount_aed, display_order )
    `)
    .eq("student_id", studentId)
    .order("issued_on", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map(inv => {
    const stu = inv.students as { full_name_en: string } | null;
    const lines = (inv.invoice_lines as Array<{ id: string; description: string; amount_aed: number; display_order: number }> | null) ?? [];
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      status: inv.status,
      issued_on: inv.issued_on,
      due_on: inv.due_on,
      paid_on: inv.paid_on,
      amount_owed_aed: Number(inv.amount_owed_aed),
      what_for: inv.what_for,
      reference_code: inv.reference_code,
      notes: inv.notes,
      student_id: inv.student_id,
      student_name: stu?.full_name_en ?? null,
      lines: lines.sort((a, b) => a.display_order - b.display_order),
    };
  });
}

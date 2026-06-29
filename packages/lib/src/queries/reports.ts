import { serverClient } from "../supabase";

export type CommDraftRow = {
  id: string;
  status: string | null;
  created_at: string | null;
  sent_at: string | null;
  student_id: string | null;
  student_name: string | null;
  template_name: string | null;
  template_code: string | null;
};

export type ReportArchiveRow = {
  id: string;
  report_kind: string;
  scope: string;
  storage_path: string;
  generated_at: string | null;
  sent_at: string | null;
  delete_after: string | null;
  student_id: string | null;
  parent_id: string | null;
  student_name: string | null;
};

export async function getCommDrafts(limit = 100): Promise<CommDraftRow[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("comm_drafts")
    .select(`
      id, status, created_at, sent_at, student_id,
      students ( full_name_en ),
      comm_templates ( name_en, template_code )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(d => {
    const stu  = d.students as { full_name_en: string } | null;
    const tmpl = d.comm_templates as { name_en: string; template_code: string } | null;
    return {
      id: d.id,
      status: d.status,
      created_at: d.created_at,
      sent_at: d.sent_at,
      student_id: d.student_id,
      student_name: stu?.full_name_en ?? null,
      template_name: tmpl?.name_en ?? null,
      template_code: tmpl?.template_code ?? null,
    };
  });
}

export async function getCommDraftPipelineCounts() {
  const db = await serverClient();
  const { data, error } = await db
    .from("comm_drafts")
    .select("status");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.status) continue;
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

export async function getReportArchive(filters: { studentId?: string; parentId?: string } = {}): Promise<ReportArchiveRow[]> {
  const db = await serverClient();
  let q = db
    .from("report_archive")
    .select("id, report_kind, scope, storage_path, generated_at, sent_at, delete_after, student_id, parent_id, students(full_name_en)")
    .is("deleted_at", null)
    .order("generated_at", { ascending: false });
  if (filters.studentId) q = q.eq("student_id", filters.studentId);
  if (filters.parentId)  q = q.eq("parent_id", filters.parentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => {
    const stu = (r as never as { students: { full_name_en: string } | null }).students;
    return {
      id: r.id,
      report_kind: r.report_kind,
      scope: r.scope,
      storage_path: r.storage_path,
      generated_at: r.generated_at,
      sent_at: r.sent_at,
      delete_after: r.delete_after,
      student_id: r.student_id,
      parent_id: r.parent_id,
      student_name: stu?.full_name_en ?? null,
    };
  });
}

export async function getCommTemplates() {
  const db = await serverClient();
  const { data, error } = await db
    .from("comm_templates")
    .select("id, template_code, name_en, name_ar, channel, tone, is_manhaj_default, display_order")
    .order("display_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAuditLogRecent(limit = 50) {
  const db = await serverClient();
  const { data, error } = await db
    .from("audit_log")
    .select("id, actor_label, action, object_kind, object_id, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

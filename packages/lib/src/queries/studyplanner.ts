import { serverClient } from "../supabase";

export type AssessmentRow = {
  id: string;
  title: string;
  subject: string;
  scheduledOn: string;
  kind: string;
};

export async function getStudentAssessmentsThisWeek(
  studentId: string,
  from: string,
  to: string,
): Promise<AssessmentRow[]> {
  const db = await serverClient();

  const { data: student } = await db
    .from("students")
    .select("current_section_id")
    .eq("id", studentId)
    .single();
  if (!student?.current_section_id) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("assessments")
    .select("id, title, kind, scheduled_on, subjects ( name_en )")
    .eq("section_id", student.current_section_id)
    .in("kind", ["quiz", "test", "exam"])
    .gte("scheduled_on", from)
    .lte("scheduled_on", to)
    .order("scheduled_on");
  if (error) throw new Error((error as { message: string }).message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((a: any) => {
    const sub = a.subjects as { name_en: string } | null;
    return {
      id:          a.id,
      title:       a.title ?? "",
      subject:     sub?.name_en ?? "Unknown",
      scheduledOn: a.scheduled_on as string,
      kind:        a.kind,
    };
  });
}

// ── Wrap-up task persistence (study_blocks.is_done, migration 020) ──────────

export type WrapupBlock = {
  id: string;
  title: string;
  blockDate: string | null;
  isDone: boolean;
};

/** Study blocks for one day — used to restore wrap-up checkbox state. */
export async function getStudyBlocksForDate(studentId: string, date: string): Promise<WrapupBlock[]> {
  const db = await serverClient();
  // is_done landed in migration 020 — not in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("study_blocks")
    .select("id, title, block_date, is_done")
    .eq("student_id", studentId)
    .eq("block_date", date);
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((b: any) => ({
    id:        b.id,
    title:     b.title,
    blockDate: b.block_date,
    isDone:    b.is_done === true,
  }));
}

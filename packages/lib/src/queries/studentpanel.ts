import { serverClient } from "../supabase";

/**
 * Per-student detail panel for the teacher roster "Open" button:
 *   - notes           — behaviour notes logged for the student (latest first)
 *   - recentGrades    — scored assessment results (latest first)
 *   - missingHomework — homework-kind assessments where the student has no
 *                       score yet (submission tracking itself is Phase 3;
 *                       this uses the real assessment_results gap instead)
 * All three fall back to demo content in the UI when empty (OR pattern).
 */

export type PanelNote = {
  id: string;
  note: string;
  kind: string;
  observed_on: string;
  teacher_name: string | null;
};

export type PanelGrade = {
  label: string;
  subject: string | null;
  held_on: string | null;
  score: number;
  max_score: number;
};

export type PanelMissingHomework = {
  label: string;
  subject: string | null;
  held_on: string | null;
};

export type StudentPanelData = {
  notes: PanelNote[];
  recentGrades: PanelGrade[];
  missingHomework: PanelMissingHomework[];
};

export async function getStudentPanelData(studentId: string): Promise<StudentPanelData> {
  const db = await serverClient();

  const [notesRes, resultsRes] = await Promise.all([
    db.from("behaviour_notes")
      .select("id, note, kind, observed_on, teachers ( full_name, display_name )")
      .eq("student_id", studentId)
      .order("observed_on", { ascending: false })
      .limit(5),
    db.from("assessment_results")
      .select(`
        score,
        assessments ( label, kind, held_on, max_score, subjects ( name_en ) )
      `)
      .eq("student_id", studentId),
  ]);

  const notes: PanelNote[] = (notesRes.data ?? []).map(n => {
    const t = n.teachers as { full_name: string; display_name: string | null } | null;
    return {
      id: n.id,
      note: n.note,
      kind: n.kind,
      observed_on: n.observed_on,
      teacher_name: t ? (t.display_name ?? t.full_name) : null,
    };
  });

  type RawResult = {
    score: number | null;
    assessments: {
      label: string;
      kind: string;
      held_on: string | null;
      max_score: number;
      subjects: { name_en: string } | null;
    } | null;
  };

  const rows = (resultsRes.data ?? []) as RawResult[];
  const byDateDesc = (a: { held_on: string | null }, b: { held_on: string | null }) =>
    (b.held_on ?? "").localeCompare(a.held_on ?? "");

  const recentGrades: PanelGrade[] = rows
    .filter(r => r.score !== null && r.assessments !== null)
    .map(r => ({
      label: r.assessments!.label,
      subject: r.assessments!.subjects?.name_en ?? null,
      held_on: r.assessments!.held_on,
      score: r.score as number,
      max_score: Number(r.assessments!.max_score),
    }))
    .sort(byDateDesc)
    .slice(0, 5);

  const missingHomework: PanelMissingHomework[] = rows
    .filter(r => r.score === null && r.assessments?.kind === "homework")
    .map(r => ({
      label: r.assessments!.label,
      subject: r.assessments!.subjects?.name_en ?? null,
      held_on: r.assessments!.held_on,
    }))
    .sort(byDateDesc)
    .slice(0, 5);

  return { notes, recentGrades, missingHomework };
}

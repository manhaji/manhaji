"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

type ScoreRecord = {
  student_id: string;
  rubric_id: string;
  axis_code: string;
  score: number;
  notes: string | null;
  scored_by_teacher_id: string;
  scored_for_month: string;   // "YYYY-MM" — normalised to the first of the month below
  school_id: string;
  subject_id: string | null;
};

/** Normalise "YYYY-MM" to the date the DB stores ("YYYY-MM-01"). */
function monthToDate(month: string): string {
  return /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month;
}

export async function bulkSaveRubricScores(records: ScoreRecord[]) {
  if (records.length === 0) return;
  const db = await serverClient();
  const { error } = await db
    .from("rubric_scores")
    .upsert(
      records.map(d => ({
        student_id:           d.student_id,
        rubric_id:            d.rubric_id,
        axis_code:            d.axis_code,
        score:                d.score,
        notes:                d.notes,
        scored_by_teacher_id: d.scored_by_teacher_id,
        scored_for_month:     monthToDate(d.scored_for_month),
        school_id:            d.school_id,
        subject_id:           d.subject_id,
        source:               "teacher",
      })),
      // Must match the table's unique constraint exactly:
      // (student_id, subject_id, rubric_id, axis_code, scored_for_month)
      { onConflict: "student_id,subject_id,rubric_id,axis_code,scored_for_month" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/rubric");
}

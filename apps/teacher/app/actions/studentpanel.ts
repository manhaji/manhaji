"use server";

import { getStudentPanelData, type StudentPanelData } from "@manhaj/lib/queries/studentpanel";

/**
 * On-demand fetch for the roster "Open" panel. Returns empty arrays when the
 * DB has nothing (or the student is a demo row) — the client then falls back
 * to demo content (OR pattern).
 */
export async function fetchStudentPanel(studentId: string): Promise<StudentPanelData> {
  try {
    return await getStudentPanelData(studentId);
  } catch {
    return { notes: [], recentGrades: [], missingHomework: [] };
  }
}

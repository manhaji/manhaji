"use server";

import { getCoverPlan, type TeacherCoverPlan } from "@manhaj/lib/queries/cover";

/**
 * Fetches a single teacher's pre-computed cover plan on demand.
 * Keeps the initial page payload tiny — only the picker index and the
 * featured teacher's plan are sent inline; other teachers load when picked.
 */
export async function loadCoverPlan(teacher: string): Promise<TeacherCoverPlan | null> {
  return getCoverPlan(teacher);
}

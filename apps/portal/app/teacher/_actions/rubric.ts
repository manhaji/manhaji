"use server";

import { serverClient } from "@manhaj/lib";
import { revalidatePath } from "next/cache";

export async function upsertRubricScore(data: {
  rubric_id: string;
  criterion_id: string;
  student_id: string;
  score: number;
  source?: string;
  notes?: string;
}) {
  const db = await serverClient();
  // Upsert on (rubric_id, criterion_id, student_id)
  const { error } = await db
    .from("rubric_scores")
    .upsert(data as never, { onConflict: "rubric_id,criterion_id,student_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
}

export async function flagCriterionAiSuggested(criterionId: string, suggested: boolean) {
  const db = await serverClient();
  const { error } = await db
    .from("rubric_criteria")
    .update({ ai_suggested: suggested } as never)
    .eq("id", criterionId);
  if (error) throw new Error(error.message);
}

export async function createRubricCriterion(data: {
  rubric_id: string;
  label: string;
  max_score: number;
  weight?: number;
  ai_suggested?: boolean;
}) {
  const db = await serverClient();
  const { data: criterion, error } = await db
    .from("rubric_criteria")
    .insert({ ...data, ai_suggested: data.ai_suggested ?? false } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/teacher/input");
  return criterion;
}

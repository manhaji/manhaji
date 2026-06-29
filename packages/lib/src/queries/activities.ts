import { serverClient } from "../supabase";

export type ActivityEvent = {
  id: string;
  title: string;
  kind: string;
  activity_date: string;
  event_location: string | null;
  description: string | null;
  cost_aed: number | null;
  depart_time: string | null;
  return_time: string | null;
  target_sections: string[] | null;
  deadline: string | null;
};

export async function getActivitiesForYear(academicYearId: string): Promise<ActivityEvent[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("activities")
    .select(`
      id, title, kind, activity_date, event_location, description_en,
      cost_aed, depart_time, return_time, target_sections, deadline
    `)
    .eq("academic_year_id", academicYearId)
    .order("activity_date");
  if (error) throw new Error(error.message);
  return (data ?? []).map(a => ({
    id: a.id,
    title: a.title,
    kind: a.kind ?? "event",
    activity_date: a.activity_date,
    event_location: a.event_location,
    description: a.description_en,
    cost_aed: a.cost_aed ? Number(a.cost_aed) : null,
    depart_time: a.depart_time as string | null,
    return_time: a.return_time as string | null,
    target_sections: a.target_sections as string[] | null,
    deadline: a.deadline,
  }));
}

export async function getUpcomingActivities(academicYearId: string, from: string, limit = 20): Promise<ActivityEvent[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("activities")
    .select(`
      id, title, kind, activity_date, event_location, description_en,
      cost_aed, depart_time, return_time, target_sections, deadline
    `)
    .eq("academic_year_id", academicYearId)
    .gte("activity_date", from)
    .order("activity_date")
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(a => ({
    id: a.id,
    title: a.title,
    kind: a.kind ?? "event",
    activity_date: a.activity_date,
    event_location: a.event_location,
    description: a.description_en,
    cost_aed: a.cost_aed ? Number(a.cost_aed) : null,
    depart_time: a.depart_time as string | null,
    return_time: a.return_time as string | null,
    target_sections: a.target_sections as string[] | null,
    deadline: a.deadline,
  }));
}

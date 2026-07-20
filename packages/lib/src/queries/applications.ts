import { serverClient } from "../supabase";

/** Matches the live `university_app_status` enum. */
export type UniversityAppStatus =
  | "researching" | "in_progress" | "submitted" | "interview"
  | "admitted" | "rejected" | "withdrawn";

export type UniversityApp = {
  id: string;
  universityId: string | null;
  universityName: string;
  country: string;
  program: string;
  status: UniversityAppStatus;
  deadline: string | null;
  appliedOn: string | null;
  notes: string | null;
};

export async function getStudentUniversityApps(studentId: string): Promise<UniversityApp[]> {
  const db = await serverClient();
  // university_id landed in migration 020 — not in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("applications")
    .select("id, university_id, university_name, country, course, status, deadline, applied_on, notes")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) return []; // no session / RLS denied → caller uses demo data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((r: any) => ({
    id:             r.id,
    universityId:   r.university_id ?? null,
    universityName: r.university_name,
    country:        r.country ?? "",
    program:        r.course ?? "",
    status:         r.status as UniversityAppStatus,
    deadline:       r.deadline ?? null,
    appliedOn:      r.applied_on ?? null,
    notes:          r.notes ?? null,
  }));
}

// ── Universities reference list (migration 020, 40 seeded) ───────────────────

export type UniversityRef = {
  id: string;
  name: string;
  country: string;
  region: string;
};

export async function getUniversities(): Promise<UniversityRef[]> {
  const db = await serverClient();
  // Table added in migration 020 — not in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("universities")
    .select("id, name, country, region")
    .order("region")
    .order("name");
  if (error) return []; // anon session (SELECT is authenticated-only) → caller uses demo list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((r: any) => ({
    id: r.id, name: r.name, country: r.country, region: r.region,
  }));
}

// ── Test scores ──────────────────────────────────────────────────────────────

export type TestScoreRow = {
  id: string;
  testName: string;
  scoreRaw: string | null;
  scoreNumeric: number | null;
  takenOn: string | null;
  notes: string | null;
};

export async function getStudentTestScores(studentId: string): Promise<TestScoreRow[]> {
  const db = await serverClient();
  const { data, error } = await db
    .from("student_test_scores")
    .select("id, test_name, score_raw, score_numeric, taken_on, notes")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map(r => ({
    id:           r.id,
    testName:     r.test_name,
    scoreRaw:     r.score_raw,
    scoreNumeric: r.score_numeric,
    takenOn:      r.taken_on,
    notes:        r.notes,
  }));
}

// ── Master docs (migration 020 — advisor-uploaded; empty until Phase 2) ─────

export type MasterDocRow = {
  id: string;
  docType: string;
  title: string | null;
  uploadedAt: string;
  notes: string | null;
};

export async function getStudentMasterDocs(studentId: string): Promise<MasterDocRow[]> {
  const db = await serverClient();
  // Table added in migration 020 — not in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("student_master_docs")
    .select("id, doc_type, title, uploaded_at, notes")
    .eq("student_id", studentId)
    .order("uploaded_at", { ascending: false });
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((r: any) => ({
    id: r.id, docType: r.doc_type, title: r.title, uploadedAt: r.uploaded_at, notes: r.notes,
  }));
}

// ── Counselor + 1:1 booking requests (migration 020) ─────────────────────────

export type CounselorInfo = {
  id: string | null;
  name: string;
  nextSession: string | null;
};

export async function getStudentCounselor(studentId: string): Promise<CounselorInfo | null> {
  const db = await serverClient();
  const { data: student } = await db
    .from("students")
    .select("current_section_id")
    .eq("id", studentId)
    .single();
  if (!student?.current_section_id) return null;

  // Look for a teacher with counselor role linked to this section
  const { data: slots } = await db
    .from("timetable_slots")
    .select("teachers ( id, full_name, display_name, role )")
    .eq("section_id", student.current_section_id)
    .limit(20);

  const counselor = (slots ?? [])
    .map(s => (s.teachers as unknown) as { id: string; full_name: string; display_name: string | null; role: string | null } | null)
    .find(t => t?.role === "counselor" || t?.role === "school_counselor");

  if (!counselor) return null;
  return {
    id: counselor.id,
    name: counselor.display_name ?? counselor.full_name,
    nextSession: null,
  };
}

export type BookingRequestRow = {
  id: string;
  requestedStart: string;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  note: string | null;
};

/** The student's most recent open (pending/confirmed) 1:1 booking request. */
export async function getStudentBookingRequest(studentId: string): Promise<BookingRequestRow | null> {
  const db = await serverClient();
  // Table added in migration 020 — not in the generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("booking_requests")
    .select("id, requested_start, status, note")
    .eq("student_id", studentId)
    .in("status", ["pending", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return {
    id:             data[0].id,
    requestedStart: data[0].requested_start,
    status:         data[0].status,
    note:           data[0].note,
  };
}

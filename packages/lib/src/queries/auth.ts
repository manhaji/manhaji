import { serverClient } from "../supabase";

export type Role = "admin" | "teacher" | "student" | "parent";

/** Determine which role a Supabase auth user belongs to by checking each table. */
export async function getRoleForUser(userId: string): Promise<Role | null> {
  const db = await serverClient();
  const [adminRes, teacherRes, studentRes, parentRes] = await Promise.all([
    db.from("school_admins").select("id").eq("user_id", userId).maybeSingle(),
    db.from("teachers").select("id").eq("user_id", userId).maybeSingle(),
    db.from("students").select("id").eq("user_id", userId).maybeSingle(),
    db.from("parents").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (adminRes.data)   return "admin";
  if (teacherRes.data) return "teacher";
  if (studentRes.data) return "student";
  if (parentRes.data)  return "parent";
  return null;
}

export async function getCurrentAcademicYearId(): Promise<string | null> {
  const db = await serverClient();
  const { data } = await db
    .from("academic_years")
    .select("id")
    .eq("is_current", true)
    .single();
  return data?.id ?? null;
}

export async function getCurrentStudentId(): Promise<string | null> {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return data?.id ?? null;
}

export async function getCurrentTeacherId(): Promise<string | null> {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db
    .from("teachers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return data?.id ?? null;
}

export async function getCurrentParentId(): Promise<string | null> {
  const db = await serverClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db
    .from("parents")
    .select("id")
    .eq("user_id", user.id)
    .single();
  return data?.id ?? null;
}

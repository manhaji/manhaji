import { serverClient } from "../supabase";

export async function getSectionsForTeacher(teacherId: string, academicYearId: string) {
  const db = await serverClient();
  // Returns distinct sections this teacher has timetable slots in
  const { data, error } = await db
    .from("timetable_slots")
    .select("section_id, sections ( id, name, grade )")
    .eq("teacher_id", teacherId)
    .eq("sections.academic_year_id", academicYearId);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  return (data ?? [])
    .map((row: never) => (row as { sections: unknown }).sections)
    .filter((s: unknown) => {
      if (!s || typeof s !== "object") return false;
      const id = (s as { id: string }).id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export async function getSectionWithStudents(sectionId: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("sections")
    .select(`
      id, name, grade, academic_year_id, is_mapped,
      student_enrollments (
        students ( id, full_name_en, full_name_ar )
      )
    `)
    .eq("id", sectionId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMappedSections(academicYearId: string) {
  const db = await serverClient();
  const { data, error } = await db
    .from("sections")
    .select("id, name, grade, is_mapped, mapped_at, mapped_by")
    .eq("academic_year_id", academicYearId)
    .order("grade")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

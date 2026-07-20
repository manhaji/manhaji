import { redirect } from "next/navigation";

/**
 * The Input page is absorbed by the Class hub (Sprint 1.5): the next-class
 * summary and pre-class checklist now live on the Class hub's "Next week"
 * view (lessons.plan_notes + lessons.pre_class_checklist). The route stays
 * so old links keep working.
 */
export default function TeacherInputPage() {
  redirect("/teacher/classhub?week=next");
}

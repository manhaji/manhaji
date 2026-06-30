"use server";

import { login, type Role } from "@manhaj/auth";
import { serverClient } from "@manhaj/lib/supabase";
import { redirect } from "next/navigation";

const PASSWORDS: Record<Role, string> = {
  admin:   process.env.DEMO_PASSWORD_ADMIN   ?? "",
  teacher: process.env.DEMO_PASSWORD_TEACHER ?? "",
  student: process.env.DEMO_PASSWORD_STUDENT ?? "",
  parent:  process.env.DEMO_PASSWORD_PARENT  ?? "",
};

const EMAILS: Record<Role, string> = {
  admin:   "demo-admin@manhaj.school",
  teacher: "demo-teacher@manhaj.school",
  student: "demo-student@manhaj.school",
  parent:  "demo-parent@manhaj.school",
};

export async function demoLogin(role: Role) {
  const matched = await login(PASSWORDS[role]);
  if (!matched) redirect("/login?error=credentials");

  // Attempt Supabase session — ignored if demo users don't exist in auth.users.
  const db = await serverClient();
  await db.auth.signInWithPassword({ email: EMAILS[role], password: PASSWORDS[role] });

  redirect(`/${role}`);
}

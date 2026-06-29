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
  // Iron-session gate (role cookie for app routing)
  await login(PASSWORDS[role]);

  // Supabase session so JWT is set and RLS policies pass
  const db = await serverClient();
  await db.auth.signInWithPassword({ email: EMAILS[role], password: PASSWORDS[role] });

  redirect(`/${role}`);
}

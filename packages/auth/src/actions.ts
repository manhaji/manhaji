"use server";

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_OPTIONS } from "./index";

export async function logout() {
  const cookieStore = await cookies();

  // Clear Supabase session cookies if present
  const supabaseCookies = cookieStore.getAll().filter(c => c.name.startsWith("sb-"));
  for (const c of supabaseCookies) {
    cookieStore.delete(c.name);
  }

  // Destroy the iron-session role cookie
  const session = await getIronSession(cookieStore, SESSION_OPTIONS);
  session.destroy();

  redirect("/login");
}

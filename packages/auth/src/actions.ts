"use server";

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_OPTIONS } from "./index";

/**
 * Destroy the session cookie and redirect to /login.
 * Called from each role app's logout button via a form action.
 *
 * TODO (§4.1): when real auth replaces this demo gate, clear any Supabase
 * session here too (supabase.auth.signOut()) before redirecting.
 */
export async function logout() {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, SESSION_OPTIONS);
  session.destroy();
  redirect("/login");
}

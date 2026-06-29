/**
 * packages/auth — Demo gate for Manhaj.
 *
 * This is a PLACEHOLDER auth system. One shared password per role, stored as
 * env vars, validated server-side. Sessions are signed httpOnly cookies via
 * iron-session.
 *
 * This is NOT the production auth system. The real system uses Supabase
 * magic-link invitations: school_admins table, invitations table, per-user
 * audit_log tied to a real user_id. See handover §4.1 for the full spec.
 *
 * To swap: replace getSessionRole() and login() in this file. The four role
 * apps and apps/portal/middleware.ts call ONLY these functions — no password
 * logic lives outside this package.
 */

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type Role = "admin" | "teacher" | "student" | "parent";

export interface SessionData {
  role: Role;
  authMode: "demo" | "supabase";
}

export const COOKIE_NAME = "manhaj_session";

export const SESSION_OPTIONS = {
  cookieName: COOKIE_NAME,
  password: process.env.SESSION_SECRET!,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  },
};

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

/** Returns the current session role, or null if not logged in. */
export async function getSessionRole(): Promise<Role | null> {
  try {
    const session = await getSession();
    return session.role ?? null;
  } catch {
    return null;
  }
}

/** Write a role directly into the session (used after Supabase auth). */
export async function setSessionRole(role: Role): Promise<void> {
  const session = await getSession();
  session.role = role;
  session.authMode = "supabase";
  await session.save();
}

/**
 * Validate a demo password and, on match, write the session cookie.
 * Returns the matched role, or null if the password is wrong.
 */
export async function login(password: string): Promise<Role | null> {
  // Build the map at call time so env vars are always read fresh.
  const map: Partial<Record<string, Role>> = {
    [process.env.DEMO_PASSWORD_ADMIN ?? ""]:   "admin",
    [process.env.DEMO_PASSWORD_TEACHER ?? ""]: "teacher",
    [process.env.DEMO_PASSWORD_STUDENT ?? ""]: "student",
    [process.env.DEMO_PASSWORD_PARENT ?? ""]:  "parent",
  };
  // Empty-string key means the env var wasn't set — never match it.
  const role = password ? (map[password] ?? null) : null;
  if (!role) return null;
  const session = await getSession();
  session.role = role;
  session.authMode = "demo";
  await session.save();
  return role;
}

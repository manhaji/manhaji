"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "@manhaj/lib/supabase";
import { getRoleForUser } from "@manhaj/lib/queries/auth";
import { setSessionRole } from "@manhaj/auth";

export async function loginWithPassword(formData: FormData) {
  const email    = ((formData.get("email")    as string | null) ?? "").trim();
  const password =  (formData.get("password") as string | null) ?? "";

  if (!email || !password) redirect("/login?error=missing");

  const db = await serverClient();
  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error || !data.user) redirect("/login?error=credentials");

  const role = await getRoleForUser(data.user.id);
  if (!role) redirect("/login?error=norole");

  await setSessionRole(role);
  redirect(`/${role}`);
}

export async function sendMagicLink(formData: FormData) {
  const email = ((formData.get("magic_email") as string | null) ?? "").trim();
  if (!email) redirect("/login?error=missing");

  const hdrs   = await headers();
  const origin = hdrs.get("origin") ?? "http://localhost:3000";

  const db = await serverClient();
  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) redirect("/login?error=magic");
  redirect("/login?magic=sent");
}

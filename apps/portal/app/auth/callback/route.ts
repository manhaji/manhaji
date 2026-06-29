import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@manhaj/lib/supabase";
import { getRoleForUser } from "@manhaj/lib/queries/auth";
import { setSessionRole } from "@manhaj/auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const db = await serverClient();
  const { data, error } = await db.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const role = await getRoleForUser(data.user.id);
  if (!role) {
    return NextResponse.redirect(`${origin}/login?error=norole`);
  }

  await setSessionRole(role);
  return NextResponse.redirect(`${origin}/${role}`);
}

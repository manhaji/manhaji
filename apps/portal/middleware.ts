import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import { COOKIE_NAME, SESSION_OPTIONS, type Role, type SessionData } from "@manhaj/auth";

const ROLE_PREFIXES: Record<string, Role> = {
  "/admin":   "admin",
  "/teacher": "teacher",
  "/student": "student",
  "/parent":  "parent",
};

async function getRole(request: NextRequest): Promise<Role | null> {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const data = await unsealData<SessionData>(raw, { password: SESSION_OPTIONS.password });
    return data.role ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through Next.js internals and static files.
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const role = await getRole(request);

  // /login: if already logged in send to their dashboard.
  if (pathname === "/login") {
    if (role) return NextResponse.redirect(new URL(`/${role}`, request.url));
    return NextResponse.next();
  }

  // Root: redirect to dashboard or login.
  if (pathname === "/") {
    const dest = role ? `/${role}` : "/login";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Role-prefixed routes: enforce auth + role match.
  for (const [prefix, requiredRole] of Object.entries(ROLE_PREFIXES)) {
    if (pathname.startsWith(prefix)) {
      if (!role) return NextResponse.redirect(new URL("/login", request.url));
      if (role !== requiredRole) {
        return NextResponse.redirect(new URL(`/${role}`, request.url));
      }
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

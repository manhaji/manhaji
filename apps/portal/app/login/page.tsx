import { loginWithPassword, sendMagicLink } from "./actions";

export const metadata = { title: "Sign in — Manhaj" };

const ERRORS: Record<string, string> = {
  credentials: "Incorrect email or password.",
  missing:     "Please fill in all fields.",
  norole:      "This account is not registered in the system. Contact your school administrator.",
  magic:       "Could not send the link. Check the email address and try again.",
  callback:    "The sign-in link has expired or is invalid. Please request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; magic?: string }>;
}) {
  const { error, magic } = await searchParams;
  const errorMsg = error ? (ERRORS[error] ?? "Something went wrong. Please try again.") : null;
  const magicSent = magic === "sent";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F4F6FA",
      padding: "24px 16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>

        {/* Logo + wordmark */}
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "#0B2545", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, marginBottom: 14,
        }}>
          M
        </div>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: "#0B2545" }}>
          Manhaj
        </h1>
        <p style={{ margin: "4px 0 28px", fontSize: 13, color: "#5A6B82" }}>
          School Operations Platform
        </p>

        {/* Card */}
        <div style={{
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          padding: "32px 28px",
          boxShadow: "0 2px 20px rgba(11,37,69,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}>

          {/* Global error banner */}
          {errorMsg && (
            <div style={{
              marginBottom: 20, padding: "10px 14px",
              background: "#FFF5F5", border: "1px solid #FEB2B2",
              borderRadius: 8, fontSize: 13, color: "#C53030",
            }}>
              {errorMsg}
            </div>
          )}

          {/* ── Email + Password ── */}
          <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: "#1A2440" }}>
            Sign in with email
          </p>

          <form action={loginWithPassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email"
              name="email"
              placeholder="you@school.edu.om"
              autoComplete="email"
              required
              style={inputStyle}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              style={inputStyle}
            />
            <button type="submit" style={primaryBtn}>
              Sign in
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: 10, margin: "20px 0",
          }}>
            <div style={{ flex: 1, height: 1, background: "#E5EAF0" }} />
            <span style={{ fontSize: 12, color: "#9AAAB8", whiteSpace: "nowrap" }}>or sign in with a link</span>
            <div style={{ flex: 1, height: 1, background: "#E5EAF0" }} />
          </div>

          {/* ── Magic link ── */}
          {magicSent ? (
            <div style={{
              padding: "14px 16px",
              background: "#F0FDF4", border: "1px solid #86EFAC",
              borderRadius: 10, fontSize: 13, color: "#166534",
              textAlign: "center", lineHeight: 1.5,
            }}>
              <strong>Check your inbox.</strong><br />
              We sent a sign-in link to your email. It expires in 1 hour.
            </div>
          ) : (
            <form action={sendMagicLink} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="email"
                name="magic_email"
                placeholder="you@school.edu.om"
                autoComplete="email"
                required
                style={inputStyle}
              />
              <button type="submit" style={ghostBtn}>
                Send magic link
              </button>
            </form>
          )}
        </div>

        {/* Demo picker link */}
        <a
          href="/demo"
          style={{
            marginTop: 20, fontSize: 13,
            color: "#3D5A80", textDecoration: "none", fontWeight: 500,
          }}
        >
          Demo Picker →
        </a>

      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 13px",
  borderRadius: 8, border: "1px solid #E5EAF0",
  fontSize: 14, color: "#1A2440", outline: "none",
  background: "#FAFBFD", boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  borderRadius: 8, background: "#0B2545",
  color: "#fff", fontWeight: 600, fontSize: 14,
  border: "none", cursor: "pointer", marginTop: 2,
};

const ghostBtn: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  borderRadius: 8, background: "#fff",
  color: "#3D5A80", fontWeight: 600, fontSize: 14,
  border: "1px solid #C8D6E5", cursor: "pointer",
};

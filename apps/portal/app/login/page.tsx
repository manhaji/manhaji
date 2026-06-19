import { loginAction } from "./actions";

export const metadata = { title: "Login — Manhaj" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="logo" style={{ marginBottom: 16 }}>M</div>
        <h1 style={{ marginBottom: 4 }}>Manhaj</h1>
        <p style={{ marginBottom: 24, opacity: 0.6, fontSize: 14 }}>
          School Operations Platform
        </p>
        <form action={loginAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            name="password"
            placeholder="Enter your access code"
            autoComplete="current-password"
            required
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 15 }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
            }}
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

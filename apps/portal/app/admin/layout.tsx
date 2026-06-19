import AdminNav from "@manhaj/admin/app/components/AdminNav";
import AskManhajDrawer from "@manhaj/admin/app/components/AskManhajDrawer";
import { LogoutButton } from "@manhaj/auth/components";

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";
const AY = process.env.ACADEMIC_YEAR || "2026-2027";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="topbar">
        <div className="brand">
          <div className="logo">M</div>
          <div>
            <div className="brand-name">
              Manhaj <span className="brand-sub">· {SCHOOL_NAME}</span>
            </div>
          </div>
          <AdminNav />
        </div>
        <div className="top-right">
          <LogoutButton />
          <span style={{ fontSize: 12 }}>AY {AY}</span>
          <div className="avatar" title="Principal">PR</div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} style={{ paddingBottom: "90px" }}>{children}</main>
      <AskManhajDrawer />
    </>
  );
}

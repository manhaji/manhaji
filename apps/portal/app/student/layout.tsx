import StudentNav from "@manhaj/student/app/components/StudentNav";
import { LogoutButton } from "@manhaj/auth/components";

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
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
          <StudentNav />
        </div>
        <div className="top-right">
          <LogoutButton />
          <span style={{ fontSize: 12 }}>Layla Al-Habsi · 10A</span>
          <div className="avatar" title="Student">LA</div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
    </>
  );
}

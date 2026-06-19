import TeacherNav from "@manhaj/teacher/app/components/TeacherNav";

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";
const AY = process.env.ACADEMIC_YEAR || "2026-2027";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
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
          <TeacherNav />
        </div>
        <div className="top-right">
          <span style={{ fontSize: 12 }}>AY {AY}</span>
          <div className="avatar" title="Ms Swart">MS</div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
    </>
  );
}

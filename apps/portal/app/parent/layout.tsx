import ParentNav from "@manhaj/parent/app/components/ParentNav";
import ChildSwitcher from "@manhaj/parent/app/components/ChildSwitcher";
import { ActiveChildProvider } from "@manhaj/lib/child";

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <ActiveChildProvider>
        <header className="topbar">
          <div className="brand">
            <div className="logo">M</div>
            <div>
              <div className="brand-name">
                Manhaj <span className="brand-sub">· {SCHOOL_NAME}</span>
              </div>
            </div>
            <ParentNav />
          </div>
          <div className="top-right">
            <span style={{ fontSize: 12 }}>Mr Al-Habsi</span>
            <div className="avatar" title="Parent">P</div>
          </div>
        </header>
        <ChildSwitcher />
        <main id="main-content" tabIndex={-1}>{children}</main>
      </ActiveChildProvider>
    </>
  );
}

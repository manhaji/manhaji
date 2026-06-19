/**
 * Layout for the student app — topbar + StudentNav.
 *
 * Phase 1 hard-codes the demo student as Layla Al-Habsi. Phase 2 wires real
 * student identity (either via auth or a query param like the parent report).
 */

import type { Metadata } from "next";
import "@manhaj/ui/globals.css";
import "@manhaj/ui/tokens.css";
import StudentNav from "./components/StudentNav";

export const metadata: Metadata = {
  title: "Manhaj Student — School Ops Platform",
  description: "Student dashboard for K-12 school operations.",
  robots: { index: false, follow: false },
};

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
      </head>
      <body>
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
            <span style={{ fontSize: 12 }}>Layla Al-Habsi · 10A</span>
            <div className="avatar" title="Student">LA</div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </body>
    </html>
  );
}

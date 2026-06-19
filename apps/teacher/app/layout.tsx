/**
 * Layout for the teacher app — topbar with TeacherNav + AskManhajDrawer.
 *
 * DEMO MODE: hard-coded teacher = Ms Swart (avatar "MS").
 * School name + AY from env.
 */

import type { Metadata } from "next";
import "@manhaj/ui/globals.css";
import "@manhaj/ui/tokens.css";
import TeacherNav from "./components/TeacherNav";

export const metadata: Metadata = {
  title: "Manhaj Teacher — School Ops Platform",
  description: "Teacher dashboard for K-12 school operations.",
  robots: { index: false, follow: false },
};

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";
const AY = process.env.ACADEMIC_YEAR || "2026-2027";

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
            <TeacherNav />
          </div>
          <div className="top-right">
            <span style={{ fontSize: 12 }}>AY {AY}</span>
            <div className="avatar" title="Ms Swart">MS</div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </body>
    </html>
  );
}

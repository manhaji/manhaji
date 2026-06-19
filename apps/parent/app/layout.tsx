/**
 * Layout for the parent app.
 *
 * Renders the Manhaj topbar with ParentNav, the sticky ChildSwitcher
 * underneath, and the parent-only mobile-first CSS scoped via parent.css.
 */

import type { Metadata } from "next";
import "@manhaj/ui/globals.css";
import "@manhaj/ui/tokens.css";
import "./parent.css";
import ParentNav from "./components/ParentNav";
import ChildSwitcher from "./components/ChildSwitcher";
import { ActiveChildProvider } from "@manhaj/lib/child";

export const metadata: Metadata = {
  title: "Manhaj Parent — School Ops Platform",
  description: "Parent dashboard for K-12 school operations.",
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
      </body>
    </html>
  );
}

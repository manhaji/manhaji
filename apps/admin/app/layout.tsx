import type { Metadata } from "next";
import "@manhaj/ui/globals.css";
import "@manhaj/ui/tokens.css";
import AdminNav from "./components/AdminNav";
import AskManhajDrawer from "./components/AskManhajDrawer";

export const metadata: Metadata = {
  title: "Manhaj Admin — School Ops Platform",
  description: "Principal dashboard for K-12 school operations.",
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
            <AdminNav />
          </div>
          <div className="top-right">
            <span style={{ fontSize: 12 }}>AY {AY}</span>
            <div className="avatar" title="Principal">PR</div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <AskManhajDrawer />
      </body>
    </html>
  );
}

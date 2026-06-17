"use client";

/**
 * Admin top-level tab nav. Active state driven by the URL.
 *
 * Renders all 7 admin tabs from the IA spec — Dashboard (the default
 * /admin route), Faculty, Sections, Students, Attendance, Schedule, Reports.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/",                 label: "Dashboard" },
  { href: "/faculty",          label: "Faculty" },
  { href: "/section-mapping",  label: "Sections" },
  { href: "/students",         label: "Students" },
  { href: "/attendance",       label: "Attendance" },
  { href: "/schedule",         label: "Schedule" },
  { href: "/reports",          label: "Reports" },
  { href: "/input",            label: "Input Data" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Primary">
      {LINKS.map(l => {
        // Exact match for Dashboard (root /admin), prefix match for sub-routes.
        const isActive = l.href === "/"
          ? pathname === "/"
          : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={isActive ? "active" : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

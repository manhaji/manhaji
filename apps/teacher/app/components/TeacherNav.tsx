"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "Input" was absorbed by the Class hub's Next-week view (Sprint 1.5);
// /teacher/input still redirects there for old links.
const LINKS = [
  { href: "/teacher",              label: "Dashboard"          },
  { href: "/teacher/attendance",   label: "One-Tap Attendance" },
  { href: "/teacher/rubric",       label: "Rubric Scoring"     },
  { href: "/teacher/classhub",     label: "Class Hub"          },
  { href: "/teacher/substitute",   label: "Substitute"         },
];

export default function TeacherNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Teacher mode">
      {LINKS.map(l => {
        const isActive = l.href === "/teacher"
          ? pathname === "/teacher"
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

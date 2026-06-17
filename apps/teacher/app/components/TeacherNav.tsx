"use client";

/**
 * Teacher top-level tab nav.
 * Two tabs: Analyze (active on /teacher) and Input (active on /teacher/input).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/",       label: "Analyze" },
  { href: "/input",  label: "Input"   },
];

export default function TeacherNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Teacher mode">
      {LINKS.map(l => {
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

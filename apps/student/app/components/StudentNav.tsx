"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/",              label: "Dashboard" },
  { href: "/schedule",      label: "My Schedule" },
  { href: "/homework",      label: "Homework" },
  { href: "/past-reports",  label: "Past Reports" },
  { href: "/growth",        label: "My Growth" },
];

export default function StudentNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Primary">
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

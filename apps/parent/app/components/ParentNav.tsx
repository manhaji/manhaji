"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/",              label: "Dashboard" },
  { href: "/courses",       label: "Course Selection" },
  { href: "/past-reports",  label: "Past Reports" },
  { href: "/invoices",      label: "Invoices" },
  { href: "/messages",      label: "Messages" },
  { href: "/calendar",      label: "Calendar" },
];

export default function ParentNav() {
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@manhaj/auth/components";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/student",               label: "Dashboard"    },
  { href: "/student/schedule",      label: "My Schedule"  },
  { href: "/student/homework",      label: "Homework"     },
  { href: "/student/past-reports",  label: "Past Reports" },
  { href: "/student/growth",        label: "My Growth"    },
];

export default function StudentNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Primary">
      {LINKS.map(l => {
        const isActive = l.href === "/student"
          ? pathname === "/student"
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
      <LogoutButton className="nav-logout" />
    </nav>
  );
}

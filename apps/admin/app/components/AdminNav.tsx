"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/admin",                 label: "Dashboard"  },
  { href: "/admin/faculty",         label: "Faculty"    },
  { href: "/admin/section-mapping", label: "Sections"   },
  { href: "/admin/students",        label: "Students"   },
  { href: "/admin/attendance",      label: "Admissions" },
  { href: "/admin/schedule",        label: "Schedule"   },
  { href: "/admin/reports",         label: "Reports"    },
  { href: "/admin/input",           label: "Input Data" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Primary">
      {LINKS.map(l => {
        const isActive = l.href === "/admin"
          ? pathname === "/admin"
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

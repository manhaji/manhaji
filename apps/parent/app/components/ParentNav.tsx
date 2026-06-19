"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/parent",               label: "Dashboard"       },
  { href: "/parent/courses",       label: "Course Selection"},
  { href: "/parent/past-reports",  label: "Past Reports"    },
  { href: "/parent/invoices",      label: "Invoices"        },
  { href: "/parent/messages",      label: "Messages"        },
  { href: "/parent/calendar",      label: "Calendar"        },
];

export default function ParentNav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Primary">
      {LINKS.map(l => {
        const isActive = l.href === "/parent"
          ? pathname === "/parent"
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

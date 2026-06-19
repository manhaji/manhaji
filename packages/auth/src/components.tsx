"use client";

import { logout } from "./actions";

interface LogoutButtonProps {
  className?: string;
  label?: string;
}

export function LogoutButton({ className, label = "Logout" }: LogoutButtonProps) {
  return (
    <form action={logout}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}

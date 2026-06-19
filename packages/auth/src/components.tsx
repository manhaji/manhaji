"use client";

import { logout } from "./actions";

const PowerIcon = () => (
  <svg
    width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

export function LogoutButton() {
  return (
    <form action={logout} style={{ display: "contents" }}>
      <button type="submit" className="signout-btn" title="Sign out" aria-label="Sign out">
        <PowerIcon />
      </button>
    </form>
  );
}

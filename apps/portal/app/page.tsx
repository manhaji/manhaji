// Middleware handles all routing from "/": logged-in → /${role}, guest → /login.
// This page is never actually rendered but Next.js requires a default export.
export default function RootPage() {
  return null;
}

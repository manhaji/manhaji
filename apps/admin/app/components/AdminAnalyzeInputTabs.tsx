"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminAnalyzeInputTabs() {
  const pathname = usePathname();
  const onInput = pathname?.startsWith("/admin/input");
  return (
    <nav className="ai-tabs" aria-label="Admin mode">
      <Link href="/admin" className={`ai-tab ${!onInput ? "active" : ""}`}>Analyze data</Link>
      <Link href="/admin/input" className={`ai-tab ${onInput ? "active" : ""}`}>Input data</Link>
    </nav>
  );
}

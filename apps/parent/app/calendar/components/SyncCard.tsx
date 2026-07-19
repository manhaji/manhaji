"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * ICS feed route — served by this app, re-exported by the portal under
 * /parent/*. The feed is generated from the school's activities table
 * (demo events when empty), so the URLs below always carry real data.
 */
const FEED_PATH = "/parent/api/calendar/feed.ics";

export default function SyncCard({ activeChildId }: { activeChildId: string }) {
  // Server renders "" · browser renders the real host (no hydration mismatch).
  const host = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const childQuery = activeChildId === "all" ? "" : `?child=${encodeURIComponent(activeChildId)}`;
  const httpsUrl   = host ? `https://${host}${FEED_PATH}${childQuery}` : `${FEED_PATH}${childQuery}`;
  const webcalUrl  = host ? `webcal://${host}${FEED_PATH}${childQuery}` : `${FEED_PATH}${childQuery}`;
  const googleUrl  = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — leave the button as-is.
    }
  }

  return (
    <section className="cal-sync-card" aria-label="Sync calendar">
      <header className="cal-sync-head">
        <h3>Sync to your phone</h3>
        <p className="cal-sync-sub">Add school events to Apple / Google Calendar · one tap.</p>
      </header>
      <div className="cal-sync-body">
        <div className="cal-sync-left">
          <h4>One ICS feed that stays in sync</h4>
          <p>Adds today + every future school event for the active child (or the whole household). Updates when the school changes a date. Single events can be added from the list above.</p>
        </div>
        <div className="cal-sync-actions">
          <a className="cal-sync-btn primary" href={webcalUrl}>Add to Apple Calendar</a>
          <a className="cal-sync-btn primary" href={googleUrl} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>
          <button
            type="button"
            className={`cal-sync-btn ghost${copied ? " copied" : ""}`}
            onClick={copy}
            aria-live="polite"
          >
            {copied ? "Copied ✓" : "Copy ICS link"}
          </button>
        </div>
      </div>
    </section>
  );
}

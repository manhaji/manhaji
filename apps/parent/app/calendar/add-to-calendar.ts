/**
 * Per-event "add to calendar" URL builders.
 *
 * - Google: calendar.google.com render URL carrying title/dates/location/notes.
 * - Apple (and every other calendar app): a downloadable single-event .ics,
 *   generated from the same event data via the shared RFC-5545 generator.
 */

import type { CalendarEvent } from "@manhaj/lib/mock-calendar";
import { eventsToIcs } from "@manhaj/lib/ics";

/** "2026-05-12T09:30:00+04:00" → "20260512T093000" (local wall-clock). */
function toGoogleLocal(iso: string): string {
  return iso.slice(0, 19).replace(/[-:]/g, "");
}

/** "2026-05-12T…" → "20260512". */
function toGoogleDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/** Google Calendar event-template URL with the event's data inline. */
export function googleEventUrl(ev: CalendarEvent): string {
  let dates: string;
  if (ev.all_day) {
    // All-day DTEND is exclusive — push the end forward one day.
    const end = new Date(ev.ends_at.slice(0, 10) + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + 1);
    dates = `${toGoogleDate(ev.starts_at)}/${end.toISOString().slice(0, 10).replace(/-/g, "")}`;
  } else {
    dates = `${toGoogleLocal(ev.starts_at)}/${toGoogleLocal(ev.ends_at)}`;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text:   ev.title,
    dates,
    ctz:    "Asia/Muscat",
  });
  if (ev.location)    params.set("location", ev.location);
  if (ev.description) params.set("details", ev.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Downloadable single-event .ics as a data: URI (opens in Apple Calendar). */
export function eventIcsDataUri(ev: CalendarEvent): string {
  const ics = eventsToIcs([ev], `Manhaji · ${ev.title}`);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

/** Safe filename for the .ics download. */
export function eventIcsFilename(ev: CalendarEvent): string {
  const slug = ev.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "event"}.ics`;
}

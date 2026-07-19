import type { CalendarEvent } from "@manhaj/lib/mock-calendar";
import { formatDate, relativeDay } from "@manhaj/lib/mock-calendar";
import { DEMO_CHILDREN } from "@manhaj/lib/child";
import { googleEventUrl, eventIcsDataUri, eventIcsFilename } from "../add-to-calendar";

const TYPE_LABEL: Record<CalendarEvent["type"], string> = {
  exam: "EXAM", meeting: "MEETING", event: "EVENT", club: "CLUB", holiday: "HOLIDAY",
};

export default function UpcomingList({
  events, multiChild,
}: {
  events:     CalendarEvent[];
  multiChild: boolean;
}) {
  if (events.length === 0) {
    return (
      <section className="cal-up-card" aria-label="Upcoming events">
        <header className="cal-up-head"><h3>Upcoming · next 14 days</h3></header>
        <p className="cal-up-empty">No upcoming events in the next 14 days.</p>
      </section>
    );
  }
  return (
    <section className="cal-up-card" aria-label="Upcoming events">
      <header className="cal-up-head">
        <h3>Upcoming · next 14 days</h3>
        <p className="cal-up-sub">List view of the calendar above.</p>
      </header>
      <ul className="cal-up-list" role="list">
        {events.map(ev => {
          const child = ev.child_id === "household"
            ? { full_name: "Household", initial: "⌂" }
            : DEMO_CHILDREN.find(c => c.id === ev.child_id);
          return (
            <li key={ev.id} className="cal-up-row">
              <span className="cal-up-when">{relativeDay(ev.starts_at)}</span>
              <span className="cal-up-body">
                <span className="cal-up-title">{ev.title}</span>
                <span className="cal-up-meta">
                  {formatDate(ev.starts_at, { withTime: !ev.all_day })}
                  {ev.location && ` · ${ev.location}`}
                  {ev.description && ` · ${ev.description}`}
                </span>
              </span>
              <span className="cal-up-tags">
                {multiChild && (
                  <span className="cal-up-childtag">
                    <span className="cal-up-childav">{child?.initial ?? "?"}</span>
                    {child?.full_name?.split(" ")[0] ?? ""}
                  </span>
                )}
                <span className={`cal-up-typetag cal-type-${ev.type}`}>{TYPE_LABEL[ev.type]}</span>
                <span className="cal-up-add" aria-label={`Add ${ev.title} to your calendar`}>
                  <a
                    className="cal-up-add-btn"
                    href={googleEventUrl(ev)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Add "${ev.title}" to Google Calendar`}
                  >
                    + Google
                  </a>
                  <a
                    className="cal-up-add-btn"
                    href={eventIcsDataUri(ev)}
                    download={eventIcsFilename(ev)}
                    title={`Download "${ev.title}" as .ics (Apple Calendar)`}
                  >
                    + Apple
                  </a>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

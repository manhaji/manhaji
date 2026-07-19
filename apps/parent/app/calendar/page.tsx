import { getCurrentAcademicYearId } from "@manhaj/lib/queries/auth";
import { getActivitiesForYear } from "@manhaj/lib/queries/activities";
import { MOCK_EVENTS, type CalendarEvent, type EventType } from "@manhaj/lib/mock-calendar";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";

function kindToEventType(kind: string): EventType {
  const map: Record<string, EventType> = {
    trip: "event", exam: "exam", assembly: "event",
    meeting: "meeting", club: "club", holiday: "holiday",
    workshop: "event", sports: "event",
  };
  return (map[kind.toLowerCase()] as EventType | undefined) ?? "event";
}

export default async function ParentCalendarPage() {
  const academicYearId = await getCurrentAcademicYearId().catch(() => null);

  const activities = academicYearId
    ? await getActivitiesForYear(academicYearId).catch(() => [])
    : [];

  // Map activities to CalendarEvent shape that CalendarClient expects
  const events: CalendarEvent[] = activities.map(a => {
    const hasTime = Boolean(a.depart_time);
    const starts_at = hasTime
      ? `${a.activity_date}T${(a.depart_time as string).slice(0, 5)}:00+04:00`
      : `${a.activity_date}T08:00:00+04:00`;
    const ends_at = a.return_time
      ? `${a.activity_date}T${(a.return_time as string).slice(0, 5)}:00+04:00`
      : `${a.activity_date}T17:00:00+04:00`;
    return {
      id: a.id,
      title: a.title,
      type: kindToEventType(a.kind),
      starts_at,
      ends_at,
      all_day: !hasTime,
      child_id: "household" as const,
      location: a.event_location ?? undefined,
      description: a.description ?? undefined,
    };
  });

  return <CalendarClient events={events.length > 0 ? events : MOCK_EVENTS} />;
}

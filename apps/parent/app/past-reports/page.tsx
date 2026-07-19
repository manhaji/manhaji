import { getCurrentParentId } from "@manhaj/lib/queries/auth";
import { getReportArchive } from "@manhaj/lib/queries/reports";
import PastReportsClient from "./PastReportsClient";

export const dynamic = "force-dynamic";

export default async function ParentPastReportsPage() {
  const parentId = await getCurrentParentId().catch(() => null);
  const reports = parentId
    ? await getReportArchive({ parentId }).catch(() => [])
    : [];
  return <PastReportsClient reports={reports} />;
}

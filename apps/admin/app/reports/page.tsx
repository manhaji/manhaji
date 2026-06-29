import { getCommDraftPipelineCounts } from "@manhaj/lib/queries/reports";
import ReportsPageClient from "./ReportsPageClient";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const pipelineCounts = await getCommDraftPipelineCounts();
  return <ReportsPageClient pipelineCounts={pipelineCounts} />;
}

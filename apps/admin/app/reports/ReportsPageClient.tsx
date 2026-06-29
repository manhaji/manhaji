"use client";

import { useState } from "react";

import {
  MOCK_SECTIONS, MOCK_AUDIT, reportKpis,
} from "@manhaj/lib/mock-reports";
import type { PipelineStat } from "@manhaj/lib/mock-reports";
import { reportsAdminSummary } from "@manhaj/lib/summary";

import { AiBriefingHeader } from "@manhaj/ui";
import { BreadcrumbLensBar, type Lens } from "@manhaj/ui";
import { FilterChipRow, type Chip } from "@manhaj/ui";

import KpiRow               from "./components/KpiRow";
import PipelineFunnel       from "./components/PipelineFunnel";
import SectionProgress      from "./components/SectionProgress";
import ScheduleNextBatch    from "./components/ScheduleNextBatch";
import TemplatesShelf       from "./components/TemplatesShelf";
import EngagementHeatmap    from "./components/EngagementHeatmap";
import SendHistory          from "./components/SendHistory";
import DeliveryDiagnostics  from "./components/DeliveryDiagnostics";
import AbTestResults        from "./components/AbTestResults";
import DraftReview          from "./components/DraftReview";
import ComplianceLog        from "./components/ComplianceLog";

const STAGE_LABELS: Record<string, string> = {
  draft: "Drafts", review: "In review", ready: "Ready to send",
  sent: "Sent", opened: "Opened", replied: "Replied", bounced: "Bounced",
};

export default function ReportsPageClient({ pipelineCounts }: { pipelineCounts: Record<string, number> }) {
  // Build PipelineStat[] from real counts so PipelineFunnel can receive real data in future
  const pipeline: PipelineStat[] = (["draft","review","ready","sent","opened","replied","bounced"] as const).map(stage => ({
    stage,
    count: pipelineCounts[stage] ?? 0,
    label: STAGE_LABELS[stage] ?? stage,
  }));

  const reviewCount = pipelineCounts["review"] ?? 0;
  const totalCount  = pipelineCounts["draft"]  ?? 0;
  const kpis        = reportKpis(pipeline, MOCK_SECTIONS, MOCK_AUDIT);
  const summary     = reportsAdminSummary(pipeline, MOCK_SECTIONS, MOCK_AUDIT);

  const [lens, setLens]   = useState<Lens>("principal");
  const [active, setActive] = useState<string | null>(null);

  const chips: Chip[] = [
    { key: "all",        label: "All templates",                            tone: "neutral", active: active === "all" },
    { key: "monthly",    label: `Monthly · ${totalCount}`,                  tone: "info",    active: active === "monthly" },
    { key: "term",       label: "Term reports",                             tone: "neutral", active: active === "term" },
    { key: "behaviour",  label: "Behavioural alerts",                       tone: "neutral", active: active === "behaviour" },
    { key: "attendance", label: "Attendance follow-up",                     tone: "neutral", active: active === "attendance" },
    { key: "fee",        label: "Fee reminders",                            tone: "neutral", active: active === "fee" },
    { key: "achievement",label: "Achievement spotlights",                   tone: "neutral", active: active === "achievement" },
    { key: "review",     label: `Awaiting review · ${reviewCount}`,         tone: "warn",    active: active === "review" },
    { key: "bounce",     label: `Bounce queue · ${kpis.bounced}`,           tone: "bad",     active: active === "bounce" },
  ];

  return (
    <div className="container">
      <BreadcrumbLensBar
        steps={[
          { label: "All reports" },
          { label: "Monthly · April 2026", active: true },
        ]}
        lens={lens}
        onLensChange={setLens}
      />

      <h1>Reports</h1>
      <p className="sub">Parent-comms pipeline · templates · engagement · compliance · AY 2025–26</p>

      <AiBriefingHeader summary={summary} />

      <div className="rpt-kpi-row">
        <div className="rpt-kpi-card">
          <div className="rpt-kpi-l">Drafts in pipeline</div>
          <div className="rpt-kpi-v">{totalCount}</div>
          <div className="rpt-kpi-d">monthly · April 2026</div>
        </div>
        <div className="rpt-kpi-card">
          <div className="rpt-kpi-l">Awaiting review</div>
          <div className={`rpt-kpi-v${reviewCount > 0 ? " rpt-kpi-warn" : ""}`}>{reviewCount}</div>
          <div className="rpt-kpi-d">across 4 sections</div>
        </div>
        <div className="rpt-kpi-card">
          <div className="rpt-kpi-l">Last batch · opened</div>
          <div className="rpt-kpi-v rpt-kpi-good">{kpis.open_rate}%</div>
          <div className="rpt-kpi-d">▲ +4 vs March</div>
        </div>
        <div className="rpt-kpi-card">
          <div className="rpt-kpi-l">Bounces · last batch</div>
          <div className={`rpt-kpi-v${kpis.bounced > 0 ? " rpt-kpi-bad" : ""}`}>{kpis.bounced}</div>
          <div className="rpt-kpi-d">3 resolved · 1 open</div>
        </div>
      </div>

      <FilterChipRow chips={chips} onToggle={k => setActive(prev => prev === k ? null : k)} />

      <KpiRow />
      <PipelineFunnel />
      <SectionProgress />
      <ScheduleNextBatch />
      <TemplatesShelf />
      <EngagementHeatmap />
      <SendHistory />
      <DeliveryDiagnostics />
      <AbTestResults />
      <DraftReview />
      <ComplianceLog />
    </div>
  );
}

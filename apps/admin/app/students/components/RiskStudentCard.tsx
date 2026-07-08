type RiskFlag = {
  id: string;
  severity: string;
  category: string;
  reason: string;
  status: string;
  created_at: string;
  owner_id: string | null;
};

type Student = {
  id: string;
  full_name_en: string;
  section_code: string | null;
  grade_level: string | null;
  risk_flags: RiskFlag[];
};

const SEVERITY_SCORE: Record<string, number> = { critical: 95, high: 82, medium: 54, low: 22 };
const AVATAR_COLORS: Record<string, string> = {
  critical: "#C53030", high: "#C05621", medium: "#C05621", low: "#2F855A",
};

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function topSeverity(flags: RiskFlag[]): string {
  const order = ["critical", "high", "medium", "low"];
  for (const sev of order) {
    if (flags.some(f => f.severity === sev)) return sev;
  }
  return "low";
}

export default function RiskStudentCard({ student }: { student: Student }) {
  const sev = topSeverity(student.risk_flags);
  const primaryFlag = student.risk_flags.find(f => f.severity === sev) ?? student.risk_flags[0];
  const score = SEVERITY_SCORE[sev] ?? 22;
  const avatarColor = AVATAR_COLORS[sev] ?? "#5A6B82";
  const flaggedDays = primaryFlag ? daysAgo(primaryFlag.created_at) : 0;
  const categories = [...new Set(student.risk_flags.map(f => f.category))];

  return (
    <div className={`ars-card ars-card-${sev}`}>
      <div className="ars-card-top">
        <div className="ars-card-avatar" style={{ background: avatarColor }}>
          {initials(student.full_name_en)}
        </div>
        <div className="ars-card-identity">
          <div className="ars-card-name">{student.full_name_en}</div>
          <div className="ars-card-meta">
            {student.grade_level ?? "—"}
            {student.section_code ? ` · ${student.section_code}` : ""}
            {" · "}
            <span className="ars-card-flagged">Flagged {flaggedDays}d ago</span>
          </div>
        </div>
        <div className="ars-card-score-wrap">
          <div className="ars-card-score-val" style={{ color: avatarColor }}>{score}</div>
          <div className="ars-card-score-bar">
            <div className="ars-card-score-fill" style={{ width: `${score}%`, background: avatarColor }} />
          </div>
        </div>
      </div>

      <div className="ars-card-chips">
        {categories.map(cat => (
          <span key={cat} className={`ars-signal-chip ${sev}`}>{cat}</span>
        ))}
      </div>

      {primaryFlag?.reason && (
        <div className="ars-card-brief">
          <span className="ars-brief-label">AI brief · </span>
          {primaryFlag.reason}
        </div>
      )}

      <div className="ars-card-footer">
        <span className="ars-card-owner">
          {primaryFlag?.owner_id ? `Owner: ${primaryFlag.owner_id.slice(0, 8)}…` : "Unassigned"}
        </span>
        <div className="ars-card-actions">
          <button className="ars-action-btn">Message parent</button>
          <button className="ars-action-btn primary">Open profile</button>
        </div>
      </div>
    </div>
  );
}

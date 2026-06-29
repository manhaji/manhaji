/**
 * POST /api/sections/save-mapping
 *
 * Save the section-mapping confirmations to Postgres in one round trip.
 *
 * Request body:
 *   {
 *     sections: Array<{
 *       code: string;             // section code, e.g. "9A"
 *       grade_level?: string;     // "9", "KG1", "1-2", etc.
 *       label?: string;           // "A", "AS", "AL"
 *       stream?: string;          // "regular" | "AS" | "A2" | "AL_combined" | ...
 *       capacity?: number | null;
 *       notes?: string | null;
 *     }>
 *   }
 *
 * Response:
 *   { ok: true, updated_count: number }
 *
 * On error: 400 (bad input) or 500 (DB error) with { ok: false, error: string }.
 *
 * The actual write happens inside the SECURITY DEFINER RPC
 * `manhaj_save_section_mapping_public` (see schema/009). This route is a thin
 * validator-and-forwarder.
 */

import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@manhaj/lib/supabase";

const SCHOOL_NAME = process.env.SCHOOL_NAME || "International School of Oman";

type IncomingRow = {
  code?: unknown;
  grade_level?: unknown;
  label?: unknown;
  stream?: unknown;
  capacity?: unknown;
  notes?: unknown;
};

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON." }, { status: 400 });
  }

  const rawSections = (body as { sections?: unknown })?.sections;
  if (!Array.isArray(rawSections)) {
    return NextResponse.json(
      { ok: false, error: "Body must include `sections` as an array." },
      { status: 400 },
    );
  }

  // Sanitise + drop rows without a code.
  const sections = (rawSections as IncomingRow[])
    .map(r => {
      const code = clean(r.code);
      if (!code) return null;
      let capacity: number | null = null;
      if (typeof r.capacity === "number" && Number.isFinite(r.capacity)) {
        capacity = Math.max(1, Math.min(200, Math.trunc(r.capacity)));
      } else if (typeof r.capacity === "string" && r.capacity.trim() !== "") {
        const n = Number(r.capacity);
        if (Number.isFinite(n)) capacity = Math.max(1, Math.min(200, Math.trunc(n)));
      }
      return {
        code,
        grade_level: clean(r.grade_level),
        label: clean(r.label),
        stream: clean(r.stream),
        capacity,
        notes: clean(r.notes),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (sections.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid section rows in payload." },
      { status: 400 },
    );
  }

  const sb = await serverClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("manhaj_save_section_mapping_public", {
    p_school_name: SCHOOL_NAME,
    p_sections: sections,
  });

  if (error) {
    console.error("[manhaj/save-mapping] RPC failed:", error);
    return NextResponse.json(
      { ok: false, error: "Database error while saving mapping." },
      { status: 500 },
    );
  }

  const payload = (data ?? {}) as { school_id?: string | null; updated_count?: number; error?: string };
  if (!payload.school_id) {
    return NextResponse.json(
      { ok: false, error: payload.error || "Unknown school." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    updated_count: payload.updated_count ?? 0,
  });
}

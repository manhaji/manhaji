-- Manhaj schema · 014_parent_sweep_corrections.sql
-- ============================================================================
-- Full-sweep corrections from handover_phase1_parent.pdf
-- Applied via Supabase MCP on 2026-06-29.
--
-- Tables checked and found clean (no changes needed):
--   comm_drafts, consent_records, student_parents, student_health,
--   attendance_marks, assessment_results, behaviour_notes, rubric_scores
--
-- Gaps fixed:
--
--   activities.cost_omr → cost_aed
--     Spec data table uses cost_aed throughout (AED amounts: 35, 40).
--
--   permission_slips — slip_status enum replaced + 3 columns added
--     Old enum: pending / approved / rejected / cancelled
--     New enum: not_started / draft / signed / declined  (§P4 spec)
--     Added: signed_by_parent_id (FK parents — who actually signed, may
--       differ from parent_id), signed_name (typed-name legal signature),
--       signed_at (timestamp of legal act — distinct from responded_at
--       which also covers declines).
--
--   invoices — invoice_status enum replaced + what_for added + rename
--     Old enum: draft / sent / paid / overdue / cancelled / refunded
--     New enum: draft / unpaid / paid / overdue / partial / cancelled
--       - sent → unpaid (spec terminology)
--       - partial added (spec includes it; needed for school fee installments)
--       - refunded dropped (Manhaj is display-only over school billing;
--         refunds live in the school's system, never written by Manhaj)
--     Added: what_for text ("Term 3 · Installment 3 of 4" — parent-facing label)
--     Renamed: total_omr → amount_owed_aed (spec column name + AED alignment)
--
--   invoice_lines — stripped retail pricing, renamed amount column
--     Dropped: quantity, unit_price_omr (generated column computed as
--       quantity × unit_price_omr — school fee lines are flat amounts,
--       not retail qty × price; the founder note confirms deliberately minimal)
--     Added: amount_aed (plain numeric; spec: description | amount_aed only)
-- ============================================================================

SET search_path = public;

-- ============================================================
-- 1. slip_status ENUM — replace entirely
-- ============================================================
ALTER TABLE permission_slips ALTER COLUMN status DROP DEFAULT;
ALTER TABLE permission_slips ALTER COLUMN status TYPE text;
DROP TYPE slip_status;
CREATE TYPE slip_status AS ENUM ('not_started', 'draft', 'signed', 'declined');
ALTER TABLE permission_slips
    ALTER COLUMN status TYPE slip_status
        USING CASE status
            WHEN 'approved'  THEN 'signed'
            WHEN 'rejected'  THEN 'declined'
            WHEN 'cancelled' THEN 'declined'
            ELSE 'not_started'
        END::slip_status,
    ALTER COLUMN status SET DEFAULT 'not_started';

-- ============================================================
-- 2. permission_slips — add signature columns
-- ============================================================
ALTER TABLE permission_slips
    ADD COLUMN IF NOT EXISTS signed_by_parent_id uuid REFERENCES parents(id),
    ADD COLUMN IF NOT EXISTS signed_name          text,
    ADD COLUMN IF NOT EXISTS signed_at            timestamptz;

-- ============================================================
-- 3. activities — currency column rename
-- ============================================================
ALTER TABLE activities RENAME COLUMN cost_omr TO cost_aed;

-- ============================================================
-- 4. invoice_status ENUM — replace to match spec
-- ============================================================
ALTER TABLE invoices ALTER COLUMN status DROP DEFAULT;
ALTER TABLE invoices ALTER COLUMN status TYPE text;
DROP TYPE invoice_status;
CREATE TYPE invoice_status AS ENUM ('draft', 'unpaid', 'paid', 'overdue', 'partial', 'cancelled');
ALTER TABLE invoices
    ALTER COLUMN status TYPE invoice_status
        USING CASE status
            WHEN 'sent'      THEN 'unpaid'
            WHEN 'refunded'  THEN 'paid'
            ELSE status
        END::invoice_status,
    ALTER COLUMN status SET DEFAULT 'draft';

-- ============================================================
-- 5. invoices — add what_for, rename amount column
-- ============================================================
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS what_for text;
ALTER TABLE invoices RENAME COLUMN total_omr TO amount_owed_aed;

-- ============================================================
-- 6. invoice_lines — strip retail columns, add flat amount
--    total_omr was a generated column (qty × unit_price), so
--    DROP CASCADE removes it along with quantity.
-- ============================================================
ALTER TABLE invoice_lines DROP COLUMN IF EXISTS quantity CASCADE;
ALTER TABLE invoice_lines DROP COLUMN IF EXISTS unit_price_omr;
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS amount_aed numeric NOT NULL DEFAULT 0;

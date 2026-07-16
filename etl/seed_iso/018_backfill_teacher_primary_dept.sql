-- 018_backfill_teacher_primary_dept.sql
--
-- OPTIONAL / DRAFT — NOT APPLIED to the live database.
--
-- Context (Sprint-1 task S2.1): `teachers.primary_dept` is NULL for every row,
-- so the admin Faculty page derives the department in application code from the
-- free-text `teachers.primary_subject_text` column
-- (see packages/lib/src/queries/teachers.ts -> deriveDepartment()).
--
-- This migration would persist that same derivation into `primary_dept` so the
-- column stops being NULL. It is a follow-up only: the demo fix is the code-side
-- derivation, and the database-engineer should own whether/when this runs.
-- Ordering of the WHEN branches mirrors the priority in deriveDepartment().
--
-- Review notes before applying:
--   * This overwrites primary_dept only where it is currently NULL (WHERE guard),
--     so any real values entered later are preserved.
--   * The regexes are case-insensitive (~*) and word-boundary anchored (\y) to
--     match the JS \b behaviour.

update teachers t
set primary_dept = case
    when nullif(trim(t.primary_subject_text), '') is null then 'Unassigned'
    when t.primary_subject_text ~* '\y(MATH|MATHS|MS)\y'                                            then 'Mathematics'
    when t.primary_subject_text ~* '\y(SCIENCE|SC|CHEM|CHEMISTRY|BIO|BIOLOGY|PHY|PHYSICS)\y'         then 'Sciences'
    when t.primary_subject_text ~* '\yENGLISH\y'                                                     then 'English'
    when t.primary_subject_text ~* '\yARABIC\y'                                                      then 'Arabic'
    when t.primary_subject_text ~* '\yFRENCH\y'                                                      then 'French'
    when t.primary_subject_text ~* '\yISLAMIC\y'                                                     then 'Islamic Studies'
    when t.primary_subject_text ~* '\y(SSA|SSE|SOCIAL|BUSINESS|ECO|ECONOMICS|HISTORY|GEOGRAPH|CIVIC)' then 'Humanities'
    when t.primary_subject_text ~* '\yPE\y'                                                          then 'Physical Education'
    when t.primary_subject_text ~* '\y(ART|MUSIC)\y'                                                 then 'Arts'
    when t.primary_subject_text ~* '\y(IT|ICT)\y'                                                    then 'ICT'
    else 'Other'
  end
where t.primary_dept is null;

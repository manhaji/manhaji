-- Manhaj schema · 009_section_mapping_save.sql
-- ============================================================================
-- WHAT THIS DOES (plain English)
-- ----------------------------------------------------------------------------
-- The section-mapping page in the demo currently dumps a SQL script into a
-- modal that the user has to copy + paste into the Supabase SQL editor. That
-- is a credibility leak ("looks half-built") and a workflow leak (anybody
-- who isn't comfortable with SQL will refuse to use it).
--
-- This migration adds ONE SECURITY DEFINER RPC that the new Next.js page
-- calls directly — one click, mapping saved.
--
--   manhaj_save_section_mapping_public(school_name, sections jsonb)
--     • Takes a JSON array of confirmed rows from the UI
--     • Updates each matching section row in one transaction
--     • Stamps is_mapped = true, mapped_at = now()
--     • Returns { updated_count, school_id } for the UI to display
--
-- Why SECURITY DEFINER + anon-callable: the password-gated demo has no
-- authenticated user. The function runs as the function-owner (postgres
-- role), so RLS is bypassed inside the function only. The function itself
-- enforces the safety belt: it only updates rows belonging to the named
-- school, and only for known section codes already in the table.
-- ============================================================================

set search_path = public;

create or replace function manhaj_save_section_mapping_public(
    p_school_name text,
    p_sections    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_school_id    uuid;
    v_updated      int := 0;
    v_row          jsonb;
    v_code         text;
    v_grade_level  text;
    v_label        text;
    v_stream       text;
    v_capacity     int;
    v_notes        text;
    v_n            int;
begin
    if p_sections is null or jsonb_typeof(p_sections) <> 'array' then
        raise exception 'p_sections must be a JSON array';
    end if;

    select id into v_school_id from schools where name = p_school_name;
    if v_school_id is null then
        return jsonb_build_object(
            'school_id',     null,
            'updated_count', 0,
            'error',         'unknown school'
        );
    end if;

    -- Iterate the rows and update each in turn. We update by (school_id, code)
    -- since the UI knows the code; the academic year is implied by the school
    -- having exactly one current AY row at demo time.
    for v_row in select * from jsonb_array_elements(p_sections)
    loop
        v_code        := nullif(trim(v_row ->> 'code'), '');
        v_grade_level := nullif(trim(v_row ->> 'grade_level'), '');
        v_label       := nullif(trim(v_row ->> 'label'), '');
        v_stream      := nullif(trim(v_row ->> 'stream'), '');
        v_notes       := nullif(trim(v_row ->> 'notes'), '');

        -- Capacity comes in as a number or null. nullif on cast first.
        if (v_row ->> 'capacity') is not null and (v_row ->> 'capacity') <> '' then
            begin
                v_capacity := (v_row ->> 'capacity')::int;
            exception when others then
                v_capacity := null;
            end;
        else
            v_capacity := null;
        end if;

        if v_code is null then
            continue;  -- skip blanks defensively
        end if;

        update sections
        set grade_level = coalesce(v_grade_level, grade_level),
            label       = v_label,
            stream      = v_stream,
            capacity    = v_capacity,
            notes       = v_notes,
            is_mapped   = true,
            mapped_at   = now()
        where school_id = v_school_id
          and code      = v_code;

        get diagnostics v_n = row_count;
        v_updated := v_updated + v_n;
    end loop;

    return jsonb_build_object(
        'school_id',     v_school_id,
        'updated_count', v_updated
    );
end;
$$;

grant execute on function manhaj_save_section_mapping_public(text, jsonb) to anon, authenticated;

comment on function manhaj_save_section_mapping_public(text, jsonb) is
    'Anonymous bulk save of section-mapping confirmations from the demo UI. Updates grade_level/label/stream/capacity/notes + is_mapped=true + mapped_at=now() for every section matched by (school_id, code). Returns { school_id, updated_count }.';

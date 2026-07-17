-- 019_merge_duplicate_teachers.sql
-- Merge 27 duplicate faculty rows into their contract "keeper" rows.
--
-- Context: the Manhaji teachers table held 105 rows for ~78 real teachers.
-- 27 of them are timetable-import "twins" (no contract, blank primary_subject_text
-- -> rendered as department "Unassigned") that carry a real teacher's 789
-- timetable_slots + 1 staff_absence, while the matching contract row (the keeper)
-- shows 0 load. This migration repoints those slots/absence onto the keeper,
-- copies the readable proper-case name from the twin onto the keeper, deletes the
-- 27 twins, and leaves 78 teachers.
--
-- Explicitly LEFT ALONE (9 remaining non-contract rows, NOT touched here):
--   Demo Teacher, Sandra Swart (demo logins); DV/H, H/DV, IBZ/DV, IBZ/H, FM/KAS
--   (co-teaching initials pairs); Unassigned (vacancy); Melissa - New teacher.
--
-- Faculty roster (packages/lib/src/queries/teachers.ts -> getTeachersWithLoad)
-- renders teachers.full_name, so the name polish updates full_name; display_name
-- is left NULL (getTeacherName falls back full_name).
--
-- Idempotency: guarded on a starting count of 105 teachers; safe to run once.
-- Rollback: the public._teacher_merge_backup table snapshots every deleted row +
-- moved slot/absence ids; manual rollback recipe is at the bottom of this file.
--
-- Must run inside a single transaction; the guard DO-blocks RAISE EXCEPTION to
-- force a rollback on any mismatch.

-- 0. Pre-check: only run against the expected 105-row starting state.
do $$
begin
  if (select count(*) from public.teachers) <> 105 then
    raise exception 'Pre-check failed: expected 105 teachers, found %',
      (select count(*) from public.teachers);
  end if;
end $$;

-- 1. Snapshot table for undo (RLS on, no policies -> bypass-RLS roles only).
create table if not exists public._teacher_merge_backup (
  dup_id                  uuid primary key,
  dup_row                 jsonb       not null,
  keeper_id               uuid        not null,
  keeper_full_name_before text        not null,
  keeper_full_name_after  text        not null,
  moved_slot_ids          uuid[]      not null default '{}',
  moved_absence_ids       uuid[]      not null default '{}',
  merged_at               timestamptz not null default now()
);
alter table public._teacher_merge_backup enable row level security;

-- 2. Snapshot the 27 duplicate rows + the slot/absence ids they currently own,
--    plus the readable name to stamp onto each keeper. Captured BEFORE any change.
--    Each row: (duplicate_id, keeper_id, readable proper-case name from duplicate).
with m(dup_id, keeper_id, readable_name) as (
  values
    ('bff85039-dba3-4b09-89d0-8900a3a37775'::uuid, '808e55b1-f1d7-4f4c-b18e-65b39ac460b7'::uuid, 'Al Walid Shamseddine'),  -- keeper AL WALEED  (31 slots)
    ('693dfbe9-cbd9-4549-a11a-888e4d6f968d'::uuid, '9e6be2e3-3480-4ac0-97cd-1a37d67d5951'::uuid, 'Claire Yvonne Hodgson'),  -- keeper CLAIRE HUDGSON  (30 slots)
    ('323c1cd5-4a62-4dfc-8f85-86efea04444e'::uuid, '537b36d3-0b4d-4d30-b488-866298ac6ba8'::uuid, 'Mohammed Saab'),  -- keeper Dr MOHD Saab  (28 slots)
    ('a0de8e50-6def-4831-9ede-fc11834de86d'::uuid, '6ef043c6-b564-4564-bc5f-736d4e4a9d5f'::uuid, 'Eliana Al Hakeem'),  -- keeper ELIANA ALHAKEEM  (38 slots)
    ('9de6140f-e354-4ea8-a24e-f69f405805b5'::uuid, '461f8f91-022f-4bde-8fa9-672a177192c5'::uuid, 'Fateme Ghajarian'),  -- keeper FATEMA  (18 slots)
    ('16aaea93-8225-4749-b1b3-adbb5c7f40ca'::uuid, 'd213199b-ef0e-488b-90d2-9667b53e137f'::uuid, 'Ghada Albhaisi'),  -- keeper Ghada Buheisi  (40 slots)
    ('69aa9550-3379-4503-99dd-b88fef5561a8'::uuid, 'fcd290e4-a665-4221-9c93-ec67258961d1'::uuid, 'Hajer Fned'),  -- keeper HAJER  (2 slots)
    ('2e7ae1e7-d83f-4a49-bdb7-3e081d01ed11'::uuid, '62a03f89-dbc6-4209-8ee0-a15f0d8e397a'::uuid, 'Hassan Seif El dein'),  -- keeper HASSAN SEIFEDDINE  (31 slots)
    ('15f752c8-c4cb-4bfb-947c-a386f62d285d'::uuid, '906f7b81-b2b4-4e56-aa18-3c1608b6378b'::uuid, 'Jessica Bitar'),  -- keeper JESSICA  (33 slots)
    ('bc63a4e3-ff48-40e9-96a4-f826a6644ae7'::uuid, 'd0df466a-ea91-4fe3-a081-cb3a44f48c4d'::uuid, 'Jinan Al Farsi'),  -- keeper JINAN  (10 slots)
    ('2f4b30ca-fa11-4cf9-a894-7ea476cc2434'::uuid, '661ee4e3-05d3-4788-9f05-bfaed2641c21'::uuid, 'Justine Roose'),  -- keeper JUSTIN ROOS  (30 slots)
    ('70fa3b20-8cbb-4617-9312-8e2b000b1092'::uuid, 'ed0e0ccc-f544-47db-8e12-3ea5ffae0ea7'::uuid, 'Khadija Ben Hamida'),  -- keeper KHADIJA  (22 slots)
    ('f026893d-17e9-4650-86c8-b52b98d5bb0d'::uuid, '1dcd848c-b4e2-4ad8-a295-da1868ba196f'::uuid, 'Khaoula Jedda'),  -- keeper KHAWLA JEDDA  (34 slots)
    ('1c96f5b2-9c9c-4612-957c-4146d268cdea'::uuid, 'ca6e7f53-6427-4180-840a-7a5382466daa'::uuid, 'Lizl Lewis'),  -- keeper LIZEL  (31 slots)
    ('942ec6fc-ccce-489d-95aa-1ffdfbdf9d56'::uuid, '46568a15-adc4-4d25-bda5-1b01b129acb0'::uuid, 'Lynn Smith'),  -- keeper LYN  (34 slots)
    ('0fe70395-286d-40ef-a4b7-a8f81aead214'::uuid, 'fe4ee070-a87d-4ad1-9fd4-80569153e4bd'::uuid, 'Mariam AlBlouchi'),  -- keeper MARIAM AL BLOUCHI  (30 slots)
    ('9e936470-618d-496d-8e28-25f07c8629c5'::uuid, '58c03da2-c566-42e3-ba5e-9f1e5d542ee0'::uuid, 'Marly Shaw'),  -- keeper Marli Shaw  (30 slots)
    ('18ecbc09-8ab0-4c36-9831-7f2eeb86f35d'::uuid, '469f26fc-a6be-45cd-8f64-7adba7a9b879'::uuid, 'Micheline Khoury'),  -- keeper MICHELIN  (29 slots)
    ('f3382a28-a5c8-4852-be76-893b04b4f0ae'::uuid, '0f1ec801-9109-45f2-ba63-98d47d189d45'::uuid, 'Mohammad Al Ali'),  -- keeper MOHD AL ALI  (30 slots)
    ('2d50738d-f8f0-41fe-b2c8-d5a6c443a1c6'::uuid, '0c830fef-e495-4400-be4f-3ababe0c376c'::uuid, 'Nagavani Puppala'),  -- keeper NAGAVANI  (42 slots)
    ('8515876e-32b4-400b-a18b-664b214bb8d9'::uuid, '8403173c-2dc7-4ee0-ab3e-b7afd12c7b4a'::uuid, 'Rafah Al Khatib'),  -- keeper RAFAH Khatib  (24 slots)
    ('6bf13a1f-2f71-4337-847b-bce891ce1587'::uuid, '1dceec5c-072b-416a-ba60-688896595c49'::uuid, 'Raheeq Merhi'),  -- keeper RAHEEQ MER3I  (35 slots)
    ('5a6173f5-df0e-467e-a2f5-fff4dbb28e4c'::uuid, 'cdd13728-dd39-436d-b4bb-dcf0524350db'::uuid, 'Rayan Al Humaimi'),  -- keeper RAYYAN  (29 slots)
    ('17803d04-bfd4-4c42-8301-5c0dd4474edc'::uuid, 'b46f3dee-aac9-4166-b079-32b28fd1c95e'::uuid, 'Sahar Mohamad'),  -- keeper SAHAR  (38 slots)
    ('d83e5cef-669c-4778-90f3-462252372189'::uuid, 'c1eef5a9-b9a7-447a-9645-3e274600a731'::uuid, 'Salma Dayoub'),  -- keeper SALMA DAYUB  (25 slots)
    ('c318a5c6-c308-4442-a379-8756a786366d'::uuid, 'e5e0ed48-aff7-4b4b-9d8d-6273799a0a09'::uuid, 'Shihaam Morris'),  -- keeper SHIHAM  (29 slots)
    ('37494961-2ac5-48fd-b2fd-d1b115ddd2cf'::uuid, '08d9cbcb-2278-435e-83b1-45d5a472397a'::uuid, 'Yasmeen Ali')   -- keeper YASMEEN  (36 slots)
)
insert into public._teacher_merge_backup
  (dup_id, dup_row, keeper_id, keeper_full_name_before, keeper_full_name_after,
   moved_slot_ids, moved_absence_ids)
select d.id,
       to_jsonb(d),
       k.id,
       k.full_name,
       m.readable_name,
       coalesce((select array_agg(ts.id) from public.timetable_slots ts where ts.teacher_id = d.id), '{}'::uuid[]),
       coalesce((select array_agg(sa.id) from public.staff_absences  sa where sa.teacher_id = d.id), '{}'::uuid[])
from m
join public.teachers d on d.id = m.dup_id
join public.teachers k on k.id = m.keeper_id;

do $$
begin
  if (select count(*) from public._teacher_merge_backup) <> 27 then
    raise exception 'Snapshot failed: expected 27 backup rows, got %',
      (select count(*) from public._teacher_merge_backup);
  end if;
end $$;

-- 3. Repoint timetable_slots (789) from each duplicate -> its keeper.
update public.timetable_slots ts
   set teacher_id = b.keeper_id
  from public._teacher_merge_backup b
 where ts.teacher_id = b.dup_id;

-- 4. Repoint staff_absences (1) from the duplicate -> its keeper.
update public.staff_absences sa
   set teacher_id = b.keeper_id
  from public._teacher_merge_backup b
 where sa.teacher_id = b.dup_id;

-- 5. Delete the 27 duplicate teacher rows. Must precede the name polish because of
--    the UNIQUE (school_id, full_name) constraint on teachers.
delete from public.teachers t
 using public._teacher_merge_backup b
 where t.id = b.dup_id;

-- 6. Name polish (approved): stamp the readable proper-case name onto each keeper.
update public.teachers t
   set full_name = b.keeper_full_name_after
  from public._teacher_merge_backup b
 where t.id = b.keeper_id;

-- 7. Guards: force rollback unless the end state is exactly right.
do $$
declare
  n_teachers   int;
  orphan_slots int;
  orphan_abs   int;
  keeper_load  int;
begin
  select count(*) into n_teachers from public.teachers;
  if n_teachers <> 78 then
    raise exception 'Guard failed: teachers = % (expected 78)', n_teachers;
  end if;

  select count(*) into orphan_slots
    from public.timetable_slots ts
   where ts.teacher_id in (select dup_id from public._teacher_merge_backup);
  if orphan_slots <> 0 then
    raise exception 'Guard failed: % timetable_slots still point at a deleted duplicate', orphan_slots;
  end if;

  select count(*) into orphan_abs
    from public.staff_absences sa
   where sa.teacher_id in (select dup_id from public._teacher_merge_backup);
  if orphan_abs <> 0 then
    raise exception 'Guard failed: % staff_absences still point at a deleted duplicate', orphan_abs;
  end if;

  select coalesce(sum(cnt),0) into keeper_load from (
    select count(*) cnt
      from public.timetable_slots ts
     where ts.teacher_id in (select keeper_id from public._teacher_merge_backup)
     group by ts.teacher_id
  ) q;
  if keeper_load <> 789 then
    raise exception 'Guard failed: keepers carry % slots (expected 789)', keeper_load;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual, from the snapshot):
--   begin;
--   insert into public.teachers
--     select (jsonb_populate_record(null::public.teachers, b.dup_row)).*
--       from public._teacher_merge_backup b;             -- recreate the 27 twins
--   update public.timetable_slots ts set teacher_id = b.dup_id
--     from public._teacher_merge_backup b where ts.id = any(b.moved_slot_ids);
--   update public.staff_absences sa set teacher_id = b.dup_id
--     from public._teacher_merge_backup b where sa.id = any(b.moved_absence_ids);
--   update public.teachers t set full_name = b.keeper_full_name_before
--     from public._teacher_merge_backup b where t.id = b.keeper_id;
--   drop table public._teacher_merge_backup;
--   commit;
-- ---------------------------------------------------------------------------

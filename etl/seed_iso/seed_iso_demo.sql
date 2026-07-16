-- ISO demo seeds (run AFTER schema 010_messages.sql).
-- Demo family: Ab Aziz household. Parent='azrin.abaziz@demo.manhaj.school' (father Azrin).
-- Demo student = Aara Zelia Ab Aziz (section 4A id 3f01063c-70f7-4ddf-9c89-2e2face8b237).
-- Sibling      = Aarieq Adly Ab Aziz (section 7A) for sibling-comparison.
--
-- FINAL APPLIED VERSION (idempotent): the two inserts that had no ON CONFLICT
-- in the generated file (thread_messages, substitutions) are now guarded with
-- NOT EXISTS so a re-run cannot duplicate. Everything else uses ON CONFLICT.

set search_path = public;

-- 4. DEMO LOGINS ----------------------------------------------------------
-- Auth users cannot be created via plain SQL (GoTrue-managed auth.users).
-- Create the two auth users in the Supabase dashboard / Admin API, then link:
--   update students set user_id='<AUTH_UID_STUDENT>' where id='2c4a2c32-280e-5040-803f-cd774ee5e457';
--   update parents  set user_id='<AUTH_UID_PARENT>'  where id='d8a505d5-e635-5ade-bfa4-e456e11588dd';

-- 5a. lessons + homework for the demo student's section (4A) --------------
insert into lessons (id, school_id, section_id, subject_id, teacher_id, held_on, topic, learning_objective, homework_description, homework_due_date) values
  ('3d65b61c-7bfa-5d93-9fd9-e879fed3769a','94e4ca02-4c4e-4b54-86e7-6790b185a547','3f01063c-70f7-4ddf-9c89-2e2face8b237','e10ea58b-a02e-4211-a826-d5f6661b1098','035ad215-61fb-4173-91b7-0b6a7f5096f4',current_date-2,'Arabic reading: Chapter 3','Read and summarise the passage','Write a 5-line summary of the passage',current_date+2),
  ('11965ecb-e3c2-5980-bbf3-626a346c2baa','94e4ca02-4c4e-4b54-86e7-6790b185a547','3f01063c-70f7-4ddf-9c89-2e2face8b237','4eb61cc9-923f-4a79-a0d0-2f0ae224c09d','035ad215-61fb-4173-91b7-0b6a7f5096f4',current_date-1,'Fractions: adding unlike denominators','Add fractions with unlike denominators','Worksheet 4.2 questions 1-10',current_date+3)
on conflict (id) do nothing;

-- 5b. message threads (schema 010) ---------------------------------------
insert into messages_threads (id, school_id, parent_email, student_id, subject, category, from_label, unread) values
  ('c1d53a8e-3ee0-5635-b962-0176bf741f15','94e4ca02-4c4e-4b54-86e7-6790b185a547','azrin.abaziz@demo.manhaj.school','2c4a2c32-280e-5040-803f-cd774ee5e457','Question about Arabic homework','academic','Ab Aziz family',false)
on conflict (id) do nothing;
insert into messages_threads (id, school_id, parent_email, student_id, subject, category, from_label, unread) values
  ('607bea4d-f906-5281-873d-00ae7d54d7d2','94e4ca02-4c4e-4b54-86e7-6790b185a547','azrin.abaziz@demo.manhaj.school','2c4a2c32-280e-5040-803f-cd774ee5e457','Early pickup on Thursday','admin','Ab Aziz family',false)
on conflict (id) do nothing;
insert into messages_threads (id, school_id, parent_email, student_id, subject, category, from_label, unread) values
  ('24c8543d-79d3-5a03-8513-708b305def9d','94e4ca02-4c4e-4b54-86e7-6790b185a547','azrin.abaziz@demo.manhaj.school','2c4a2c32-280e-5040-803f-cd774ee5e457','Term 2 invoice query','finance','Ab Aziz family',false)
on conflict (id) do nothing;

-- thread messages — guarded so a re-run cannot duplicate (no natural PK on body).
insert into thread_messages (thread_id, role, from_name, from_label, body)
select v.thread_id, v.role, v.from_name, v.from_label, v.body
from (values
  ('c1d53a8e-3ee0-5635-b962-0176bf741f15'::uuid,'parent','Azrin','Ab Aziz family','Is the Arabic summary due Thursday?'),
  ('c1d53a8e-3ee0-5635-b962-0176bf741f15'::uuid,'school','Ms. Agnes','Grade 4A teacher','Yes, Thursday. Thank you!'),
  ('607bea4d-f906-5281-873d-00ae7d54d7d2'::uuid,'parent','Azrin','Ab Aziz family','We need to collect Aara at 12:30 Thursday.'),
  ('24c8543d-79d3-5a03-8513-708b305def9d'::uuid,'parent','Azrin','Ab Aziz family','Could you resend the Term 2 invoice?')
) as v(thread_id, role, from_name, from_label, body)
where not exists (
  select 1 from thread_messages tm
  where tm.thread_id in (
    'c1d53a8e-3ee0-5635-b962-0176bf741f15',
    '607bea4d-f906-5281-873d-00ae7d54d7d2',
    '24c8543d-79d3-5a03-8513-708b305def9d'
  )
);

-- 5c. coverage demo: 1 absence + 1 substitution --------------------------
-- Uses a real 2025-2026 timetable_slot (Grade 10A Economics, Jessica Bitar).
insert into staff_absences (id, school_id, teacher_id, reason, reason_notes, starts_on, ends_on, status) values
  ('058153be-b405-5cf7-98cd-af030490256f','94e4ca02-4c4e-4b54-86e7-6790b185a547','15f752c8-c4cb-4bfb-947c-a386f62d285d','sick','Flu — 1 day',current_date,current_date,'approved')
on conflict (id) do nothing;

-- substitution — guarded by (absence_id, slot_id) so a re-run cannot duplicate.
insert into substitutions (school_id, absence_id, slot_id, substitute_teacher_id, notes)
select '94e4ca02-4c4e-4b54-86e7-6790b185a547'::uuid,
       '058153be-b405-5cf7-98cd-af030490256f'::uuid,
       'bdeff66b-541f-4b1d-a7c4-ac441d7e469c'::uuid,
       '808e55b1-f1d7-4f4c-b18e-65b39ac460b7'::uuid,
       'Auto-suggested cover'
where not exists (
  select 1 from substitutions s
  where s.absence_id = '058153be-b405-5cf7-98cd-af030490256f'
    and s.slot_id    = 'bdeff66b-541f-4b1d-a7c4-ac441d7e469c'
);

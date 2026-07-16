-- Record 009 / 010 / 018 in the Supabase migration tracker.
-- Idempotent: ON CONFLICT (version) DO NOTHING. Versions are fixed (dated apply
-- day 2026-07-16, numeric-suffixed) so a re-run does not create duplicates.
-- PK = version; idempotency_key is UNIQUE and also fixed here.

insert into supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key, rollback)
values
  ('20260716000009','009_section_mapping_save',
     array['-- applied from schema/009_section_mapping_save.sql (SECURITY DEFINER RPC manhaj_save_section_mapping_public)'],
     'database-engineer (approved live apply)','manhaj-009-section-mapping-save',
     array['drop function if exists manhaj_save_section_mapping_public(text, jsonb);']),
  ('20260716000010','010_messages',
     array['-- applied from schema/010_messages.sql (fixed: full_name -> full_name_en). Creates messages_threads, thread_messages, messages_audit_log + RPCs.'],
     'database-engineer (approved live apply)','manhaj-010-messages',
     array['drop view if exists parent_child_demo;','drop table if exists messages_audit_log;','drop table if exists thread_messages;','drop table if exists messages_threads;']),
  ('20260716000018','018_backfill_teacher_primary_dept',
     array['-- applied from schema/018_backfill_teacher_primary_dept.sql (UPDATE teachers SET primary_dept where NULL)'],
     'database-engineer (approved live apply)','manhaj-018-backfill-primary-dept',
     array['-- no automatic rollback: primary_dept backfill is a data fill; restore from backup if needed'])
on conflict (version) do nothing;

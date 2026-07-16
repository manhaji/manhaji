-- Manhaj schema · 010_messages.sql
-- ============================================================================
-- WHAT THIS DOES (plain English)
-- ----------------------------------------------------------------------------
-- Adds parent-school messaging persistence. Three tables:
--   1. messages_threads   — top-level conversation envelope
--   2. thread_messages    — individual messages inside a thread
--   3. messages_audit_log — PDPL audit trail
--
-- Demo mode: SECURITY DEFINER RPCs make these anon-callable. Production
-- (post-Phase 3) will route via authenticated parent users instead.
--
-- 2.4b-1 only writes to the DB; no email delivery. 2.4b-2 will add the
-- Resend send + inbound webhook + reply-to routing on top of these tables.
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists messages_threads (
    id                uuid primary key default gen_random_uuid(),
    school_id         uuid not null references schools(id),
    parent_email      text not null,
    student_id        uuid references students(id) on delete set null,
    subject           text not null,
    category          text not null check (category in ('academic','admin','finance','calendar')),
    from_label        text not null,
    last_activity_at  timestamptz not null default now(),
    unread            boolean not null default true,
    created_at        timestamptz not null default now()
);

create index if not exists idx_messages_threads_school_parent
  on messages_threads (school_id, parent_email, last_activity_at desc);

create table if not exists thread_messages (
    id          uuid primary key default gen_random_uuid(),
    thread_id   uuid not null references messages_threads(id) on delete cascade,
    ts          timestamptz not null default now(),
    role        text not null check (role in ('school','parent')),
    from_name   text not null,
    from_label  text not null,
    body        text not null,
    opened_at   timestamptz
);

create index if not exists idx_thread_messages_thread_ts
  on thread_messages (thread_id, ts);

create table if not exists messages_audit_log (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id),
    thread_id   uuid references messages_threads(id) on delete set null,
    ts          timestamptz not null default now(),
    direction   text not null check (direction in ('out_to_parent','in_from_parent','out_to_teacher_bcc','in_from_teacher')),
    from_email  text,
    to_email    text,
    template_id text,
    outcome     text not null
);

-- RLS off (gated by RPCs below)
alter table messages_threads   disable row level security;
alter table thread_messages    disable row level security;
alter table messages_audit_log disable row level security;

-- ---------------------------------------------------------------------------
-- 2. Demo identity view
-- ---------------------------------------------------------------------------
-- Maps the demo parent email to known student IDs. Production replaces
-- this with a real `parent_contacts` table (Phase 3).

create or replace view parent_child_demo as
  select
    'mahmoud.al-habsi@example.com'::text as parent_email,
    s.id as student_id,
    s.full_name_en as student_name
  from students s
  where s.full_name_en in ('Layla Al-Habsi','Omar Al-Habsi','Yasmin Al-Habsi');

grant select on parent_child_demo to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. RPC · list threads for a parent
-- ---------------------------------------------------------------------------
create or replace function manhaj_threads_for_parent_public(
    p_school_name  text,
    p_parent_email text
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_school_id uuid;
    v_result jsonb;
begin
    select id into v_school_id from schools where name = p_school_name;
    if v_school_id is null then
        return '[]'::jsonb;
    end if;

    select coalesce(jsonb_agg(t order by t.last_activity_at desc), '[]'::jsonb)
      into v_result
    from (
      select
        mt.id,
        mt.subject,
        mt.category,
        coalesce(mt.student_id::text, 'household') as child_id,
        mt.from_label,
        mt.last_activity_at,
        mt.unread,
        coalesce(
          (select jsonb_agg(
             jsonb_build_object(
               'id',         tm.id,
               'thread_id',  tm.thread_id,
               'ts',         tm.ts,
               'role',       tm.role,
               'from_name',  tm.from_name,
               'from_label', tm.from_label,
               'body',       tm.body,
               'opened_at',  tm.opened_at
             ) order by tm.ts asc
           )
           from thread_messages tm where tm.thread_id = mt.id),
          '[]'::jsonb
        ) as messages
      from messages_threads mt
      where mt.school_id = v_school_id
        and mt.parent_email = p_parent_email
    ) t;

    return v_result;
end;
$$;

grant execute on function manhaj_threads_for_parent_public(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC · append a message to an existing thread
-- ---------------------------------------------------------------------------
create or replace function manhaj_append_message_public(
    p_thread_id  uuid,
    p_role       text,
    p_from_name  text,
    p_from_label text,
    p_body       text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_new_id    uuid;
    v_school_id uuid;
begin
    if p_role not in ('school','parent') then
        raise exception 'invalid role: %', p_role;
    end if;

    select school_id into v_school_id from messages_threads where id = p_thread_id;
    if v_school_id is null then
        raise exception 'unknown thread: %', p_thread_id;
    end if;

    insert into thread_messages (thread_id, role, from_name, from_label, body)
      values (p_thread_id, p_role, p_from_name, p_from_label, p_body)
      returning id into v_new_id;

    update messages_threads
       set last_activity_at = now(),
           unread = case when p_role = 'school' then true else unread end
     where id = p_thread_id;

    insert into messages_audit_log (school_id, thread_id, direction, outcome)
      values (v_school_id, p_thread_id,
              case when p_role = 'school' then 'out_to_parent' else 'in_from_parent' end,
              'queued');

    return v_new_id;
end;
$$;

grant execute on function manhaj_append_message_public(uuid, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC · create a new thread + initial message
-- ---------------------------------------------------------------------------
create or replace function manhaj_create_thread_public(
    p_school_name  text,
    p_parent_email text,
    p_student_id   uuid,
    p_category     text,
    p_subject      text,
    p_from_name    text,
    p_from_label   text,
    p_body         text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_school_id  uuid;
    v_thread_id  uuid;
begin
    if p_category not in ('academic','admin','finance','calendar') then
        raise exception 'invalid category: %', p_category;
    end if;

    select id into v_school_id from schools where name = p_school_name;
    if v_school_id is null then
        raise exception 'unknown school: %', p_school_name;
    end if;

    insert into messages_threads (
        school_id, parent_email, student_id, subject, category, from_label,
        unread, last_activity_at
    ) values (
        v_school_id, p_parent_email, p_student_id, p_subject, p_category, p_from_label,
        false,      -- a thread parent just opened isn't unread for themselves
        now()
    ) returning id into v_thread_id;

    insert into thread_messages (thread_id, role, from_name, from_label, body)
      values (v_thread_id, 'parent', p_from_name, p_from_label, p_body);

    insert into messages_audit_log (school_id, thread_id, direction, outcome)
      values (v_school_id, v_thread_id, 'in_from_parent', 'queued');

    return v_thread_id;
end;
$$;

grant execute on function manhaj_create_thread_public(text, text, uuid, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC · mark a thread as read
-- ---------------------------------------------------------------------------
create or replace function manhaj_mark_thread_read_public(
    p_thread_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update messages_threads
       set unread = false
     where id = p_thread_id;
end;
$$;

grant execute on function manhaj_mark_thread_read_public(uuid) to anon, authenticated;

comment on table messages_threads   is 'Parent–school conversation envelopes. Demo phase: SECURITY DEFINER RPCs gate access.';
comment on table thread_messages    is 'Individual messages inside a thread. Multi-role (school | parent).';
comment on table messages_audit_log is 'PDPL audit trail · every send + reply + bounce row-stamped here.';

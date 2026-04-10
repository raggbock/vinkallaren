-- session_participants: tracks who joined a session (fixes RLS chicken-and-egg bug)
create table if not exists public.session_participants (
  session_id uuid not null references public.tasting_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table session_participants enable row level security;

-- Participants can see who else is in their session
create policy "participants_select" on session_participants for select using (
  exists (
    select 1 from session_participants sp
    where sp.session_id = session_participants.session_id
    and sp.user_id = auth.uid()
  )
);

-- Only host can remove participants
create policy "participants_delete" on session_participants for delete using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_participants.session_id
    and ts.host_id = auth.uid()
  )
);

-- Update is_session_participant to check session_participants instead of session_tastings
create or replace function public.is_session_participant(p_session_id uuid)
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from session_participants
    where session_id = p_session_id and user_id = auth.uid()
  );
$$;

-- Update join_session_by_code to also insert into session_participants
create or replace function public.join_session_by_code(code text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  sess record;
begin
  select id, title, host_id, join_code, mode, format, free_order, status, created_at
  into sess
  from tasting_sessions
  where join_code = upper(code) and status in ('setup', 'active');

  if not found then
    return json_build_object('error', 'Session not found or not active');
  end if;

  -- Register as participant (ignore if already joined)
  insert into session_participants (session_id, user_id)
  values (sess.id, auth.uid())
  on conflict do nothing;

  return json_build_object(
    'id', sess.id,
    'title', sess.title,
    'host_id', sess.host_id,
    'join_code', sess.join_code,
    'mode', sess.mode,
    'format', sess.format,
    'free_order', sess.free_order,
    'status', sess.status,
    'created_at', sess.created_at
  );
end;
$$;

-- Update get_session_participants to use session_participants instead of session_tastings
create or replace function public.get_session_participants(p_session_id uuid)
returns json
language sql security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'avatar_color', p.avatar_color
  )), '[]'::json)
  from profiles p
  where p.id in (
    select sp.user_id from session_participants sp where sp.session_id = p_session_id
  );
$$;

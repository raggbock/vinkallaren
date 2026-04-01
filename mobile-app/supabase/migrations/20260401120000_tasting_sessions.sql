-- tasting_sessions
create table if not exists public.tasting_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  join_code text unique not null,
  mode text not null check (mode in ('blind', 'open')),
  format text not null check (format in ('quick', 'wset')),
  free_order boolean not null default false,
  status text not null default 'active' check (status in ('active', 'revealed', 'ended')),
  created_at timestamptz not null default now()
);

-- session_wines
create table if not exists public.session_wines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tasting_sessions (id) on delete cascade,
  position integer not null,
  name text not null,
  producer text,
  country text,
  region text,
  grape text,
  vintage integer,
  type text,
  wine_id uuid references public.wines (id) on delete set null,
  created_at timestamptz not null default now()
);

-- session_tastings
create table if not exists public.session_tastings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tasting_sessions (id) on delete cascade,
  session_wine_id uuid not null references public.session_wines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer check (rating is null or rating between 1 and 5),
  notes text,
  food_pairings text[] default '{}',
  tasting_data jsonb default null,
  created_at timestamptz not null default now(),
  unique (session_wine_id, user_id)
);

-- Indexes
create index idx_tasting_sessions_host on tasting_sessions (host_id);
create index idx_tasting_sessions_join_code on tasting_sessions (join_code);
create index idx_session_wines_session on session_wines (session_id);
create index idx_session_tastings_session on session_tastings (session_id);
create index idx_session_tastings_user on session_tastings (user_id);

-- RLS: tasting_sessions
alter table tasting_sessions enable row level security;

create policy "sessions_select" on tasting_sessions for select using (
  host_id = auth.uid()
  or exists (select 1 from session_tastings st where st.session_id = tasting_sessions.id and st.user_id = auth.uid())
);
create policy "sessions_insert" on tasting_sessions for insert with check (host_id = auth.uid());
create policy "sessions_update" on tasting_sessions for update using (host_id = auth.uid());
create policy "sessions_delete" on tasting_sessions for delete using (host_id = auth.uid());

-- RLS: session_wines
alter table session_wines enable row level security;

create policy "session_wines_select" on session_wines for select using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_wines.session_id
    and (ts.host_id = auth.uid() or exists (select 1 from session_tastings st where st.session_id = ts.id and st.user_id = auth.uid()))
  )
);
create policy "session_wines_insert" on session_wines for insert with check (
  exists (select 1 from tasting_sessions ts where ts.id = session_wines.session_id and ts.host_id = auth.uid())
);
create policy "session_wines_update" on session_wines for update using (
  exists (select 1 from tasting_sessions ts where ts.id = session_wines.session_id and ts.host_id = auth.uid())
);
create policy "session_wines_delete" on session_wines for delete using (
  exists (select 1 from tasting_sessions ts where ts.id = session_wines.session_id and ts.host_id = auth.uid())
);

-- RLS: session_tastings
alter table session_tastings enable row level security;

create policy "session_tastings_select_own" on session_tastings for select using (user_id = auth.uid());
create policy "session_tastings_select_others" on session_tastings for select using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_tastings.session_id
    and (ts.mode = 'open' or ts.status in ('revealed', 'ended') or ts.host_id = auth.uid())
  )
);
create policy "session_tastings_insert" on session_tastings for insert with check (
  user_id = auth.uid()
  and exists (select 1 from tasting_sessions ts where ts.id = session_tastings.session_id and ts.status = 'active')
);
create policy "session_tastings_update" on session_tastings for update using (
  user_id = auth.uid()
  and exists (select 1 from tasting_sessions ts where ts.id = session_tastings.session_id and ts.status = 'active')
);
create policy "session_tastings_delete" on session_tastings for delete using (user_id = auth.uid());

-- RPC: join session by code (bypasses RLS for lookup)
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
  where join_code = upper(code) and status = 'active';

  if not found then
    return json_build_object('error', 'Session not found or not active');
  end if;

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

-- Enable realtime
alter publication supabase_realtime add table session_tastings;
alter publication supabase_realtime add table tasting_sessions;
alter publication supabase_realtime add table session_wines;

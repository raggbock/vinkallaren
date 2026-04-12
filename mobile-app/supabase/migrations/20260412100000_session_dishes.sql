-- session_dishes: dishes served at a tasting session
create table if not exists public.session_dishes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tasting_sessions (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index idx_session_dishes_session on session_dishes (session_id);

-- session_tasting_dishes: which dishes each taster linked to a wine
create table if not exists public.session_tasting_dishes (
  session_tasting_id uuid not null references public.session_tastings (id) on delete cascade,
  session_dish_id uuid not null references public.session_dishes (id) on delete cascade,
  primary key (session_tasting_id, session_dish_id)
);

-- RLS: session_dishes
alter table session_dishes enable row level security;

create policy "session_dishes_select" on session_dishes for select using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_dishes.session_id
    and (ts.host_id = auth.uid() or is_session_participant(ts.id))
  )
);
create policy "session_dishes_insert" on session_dishes for insert with check (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_dishes.session_id
    and ts.host_id = auth.uid()
  )
);
create policy "session_dishes_delete" on session_dishes for delete using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_dishes.session_id
    and ts.host_id = auth.uid()
  )
);

-- RLS: session_tasting_dishes
alter table session_tasting_dishes enable row level security;

create policy "session_tasting_dishes_select" on session_tasting_dishes for select using (
  exists (
    select 1 from session_tastings st
    where st.id = session_tasting_dishes.session_tasting_id
    and (
      st.user_id = auth.uid()
      or exists (
        select 1 from tasting_sessions ts
        where ts.id = st.session_id
        and (ts.mode = 'open' or ts.status in ('revealed', 'ended') or ts.host_id = auth.uid())
      )
    )
  )
);
create policy "session_tasting_dishes_insert" on session_tasting_dishes for insert with check (
  exists (
    select 1 from session_tastings st
    where st.id = session_tasting_dishes.session_tasting_id
    and st.user_id = auth.uid()
  )
);
create policy "session_tasting_dishes_delete" on session_tasting_dishes for delete using (
  exists (
    select 1 from session_tastings st
    where st.id = session_tasting_dishes.session_tasting_id
    and st.user_id = auth.uid()
  )
);

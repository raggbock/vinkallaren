-- Anonymous pageview tracking for minvinkallare.se web build.
-- One row per pageview inserted by an inline script. Reads via service_role only.

create table public.page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null,
  path text not null,
  referrer text,
  ua text,
  screen_w int,
  screen_h int,
  language text
);

create index page_views_created_at_idx on public.page_views (created_at desc);

alter table public.page_views enable row level security;

-- Anon can insert only. No select policy => anon cannot read.
create policy "anon insert page_views"
  on public.page_views for insert
  to anon
  with check (true);

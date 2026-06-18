-- PFM Broadcasts Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  message text not null check (char_length(message) between 1 and 700),
  priority text not null default 'general' check (priority in ('urgent', 'important', 'general')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists public.broadcast_reads (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 120),
  read_at timestamptz not null default now(),
  unique (broadcast_id, device_id)
);

alter table public.admin_profiles enable row level security;
alter table public.broadcasts enable row level security;
alter table public.broadcast_reads enable row level security;

-- Anyone can read active broadcasts
create policy "Public read active" on public.broadcasts for select using (is_active = true);
-- Only admins can create/update/delete
create policy "Admin insert" on public.broadcasts for insert to authenticated with check (exists (select 1 from public.admin_profiles where user_id = auth.uid() and is_admin = true));
create policy "Admin update" on public.broadcasts for update to authenticated using (exists (select 1 from public.admin_profiles where user_id = auth.uid() and is_admin = true));
create policy "Admin delete" on public.broadcasts for delete to authenticated using (exists (select 1 from public.admin_profiles where user_id = auth.uid() and is_admin = true));

-- Anyone can read/create read receipts
create policy "Public read reads" on public.broadcast_reads for select using (true);
create policy "Public insert reads" on public.broadcast_reads for insert with check (true);
create policy "Public update reads" on public.broadcast_reads for update using (true);

-- Realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.broadcasts;
alter publication supabase_realtime add table public.broadcast_reads;

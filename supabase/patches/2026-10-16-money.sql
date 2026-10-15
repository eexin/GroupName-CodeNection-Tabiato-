-- Tabiato patch, 16 Oct 2026: settle up, the group kitty and trip budgets.
-- Run once in the Supabase SQL editor (safe to run again). schema.sql already includes all of this.
-- trips.budget already exists (the planner sets it); nothing to add there.

alter table public.expenses add column if not exists from_kitty boolean not null default false;

-- who shares each expense, split equally
create table if not exists public.expense_shares (
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  primary key (expense_id, user_id)
);
create index if not exists expense_shares_trip_idx on public.expense_shares (trip_id);

-- the group kitty: money each person put in
create table if not exists public.kitty_deposits (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  currency    text not null default 'MYR',
  amount_myr  numeric(12, 2),
  added_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists kitty_deposits_trip_idx on public.kitty_deposits (trip_id);

-- "Mark as paid"
create table if not exists public.settlements (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  from_user   uuid not null references public.profiles (id) on delete cascade,
  to_user     uuid not null references public.profiles (id) on delete cascade,
  amount_myr  numeric(12, 2) not null check (amount_myr > 0),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists settlements_trip_idx on public.settlements (trip_id);

alter table public.expense_shares enable row level security;
alter table public.kitty_deposits enable row level security;
alter table public.settlements   enable row level security;

drop policy if exists "shares: members" on public.expense_shares;
create policy "shares: members" on public.expense_shares
  for all to authenticated using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id)
              and exists (select 1 from public.expenses e where e.id = expense_id and e.trip_id = expense_shares.trip_id));
drop policy if exists "kitty: members" on public.kitty_deposits;
create policy "kitty: members" on public.kitty_deposits
  for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
drop policy if exists "settlements: members read" on public.settlements;
create policy "settlements: members read" on public.settlements
  for select to authenticated using (public.is_trip_member(trip_id));
drop policy if exists "settlements: payer or payee" on public.settlements;
create policy "settlements: payer or payee" on public.settlements
  for insert to authenticated with check (public.is_trip_member(trip_id) and auth.uid() in (from_user, to_user));
drop policy if exists "settlements: undo own" on public.settlements;
create policy "settlements: undo own" on public.settlements
  for delete to authenticated using (public.is_trip_member(trip_id) and auth.uid() in (from_user, to_user));

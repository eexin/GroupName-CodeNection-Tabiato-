-- Tabiato patch, 15 Oct 2026: trips can be seen by friends only.
-- Run once in the Supabase SQL editor (safe to run again). schema.sql already includes all of this.
--
--   private  = is_public false, friends_can_view false  → only people on the trip
--   friends  = is_public false, friends_can_view true   → also the owner's friends (their profile page)
--   public   = is_public true                           → everyone signed in, and Community

alter table public.trips add column if not exists friends_can_view boolean not null default false;

-- you and `other` are accepted friends
create or replace function public.is_friend(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where status = 'accepted'
                 and ((requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid())));
$$;

-- someone who isn't on the trip may see it: public, or friends-only and you are the owner's friend
create or replace function public.is_trip_visible(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips
                 where id = t and (is_public or (friends_can_view and public.is_friend(owner_id))));
$$;

-- visible to you AND the owner left this part switched on (photos, ratings, comments, spend)
create or replace function public.is_trip_shared(t uuid, part text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trips
    where id = t and (is_public or (friends_can_view and public.is_friend(owner_id)))
      and coalesce((share_settings ->> part)::boolean, true)
  );
$$;

drop policy if exists "trips: read" on public.trips;
create policy "trips: read" on public.trips
  for select to authenticated using (owner_id = auth.uid() or public.has_trip_access(id) or is_public
                                     or (friends_can_view and public.is_friend(owner_id)));

drop policy if exists "places: read" on public.places;
create policy "places: read" on public.places
  for select to authenticated using (public.is_trip_member(trip_id) or public.is_trip_visible(trip_id));

drop policy if exists "likes: read" on public.likes;
create policy "likes: read" on public.likes for select to authenticated using (user_id = auth.uid() or public.is_trip_visible(trip_id));
drop policy if exists "likes: add own" on public.likes;
create policy "likes: add own" on public.likes for insert to authenticated with check (user_id = auth.uid() and public.is_trip_visible(trip_id));
drop policy if exists "saves: add own" on public.saves;
create policy "saves: add own" on public.saves for insert to authenticated with check (user_id = auth.uid() and public.is_trip_visible(trip_id));

-- PostgREST reads the new column straight away
notify pgrst, 'reload schema';

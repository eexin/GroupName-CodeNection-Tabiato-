-- ============================================================================
-- Tabiato 旅跡 — Supabase schema
-- Run once in Supabase → SQL Editor → New query → paste → Run.
--
-- Model: a trip has members; a trip has places; photos, spend, ratings, notes and
-- comments hang off a place. Every child table carries trip_id so row-level security
-- can answer "is this user a member of that trip?" without joins.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '',
  avatar_url    text,
  travel_style  jsonb not null default '{}'::jsonb,   -- budget band, interests, pace (Figma 04); .learned = the style Ato learned from finished trips
  onboarded_at  timestamptz,                          -- null until the profile setup screen is done
  username      text unique check (username ~ '^[a-z0-9_]{3,24}$'),   -- tabiato.app/u/<username>
  -- Figma 24 MEMORY switches
  settings      jsonb not null default '{"auto_pin": true, "friends_can_add": true, "ato_insights": true}'::jsonb,
  created_at    timestamptz not null default now()
);

-- every new sign-up gets a profile row automatically
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), ''),
    -- a unique starting handle; the user can change it in profile setup
    left(nullif(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), ''), 16)
      || '_' || substr(md5(new.id::text), 1, 4)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.friendships (
  requester   uuid not null references public.profiles (id) on delete cascade,
  addressee   uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- ---------------------------------------------------------------------------
-- Trips and membership
-- ---------------------------------------------------------------------------

create table public.trips (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  destination  text,
  start_date   date,
  end_date     date,
  status       text not null default 'ongoing' check (status in ('planned', 'ongoing', 'finished')),
  is_public    boolean not null default false,
  friends_can_view boolean not null default false,   -- not public, but the owner's friends may see it (their profile page)
  -- planner fields (Figma 29): destination centre from geocoding, budget, pace and interests
  dest_lat     double precision,
  dest_lng     double precision,
  budget       numeric(12, 2),
  plan_style   jsonb not null default '{}'::jsonb,
  country_code text,                                 -- ISO 3166-1 alpha-2, for weather, alerts and intel
  demo_alert   jsonb,                                -- a clearly labelled demo alert for presentations; never shown as real
  -- Figma 36a: what a public trip shows. Notes and spending are never public, whatever this says.
  share_settings jsonb not null default '{"photos": true, "ratings": true, "comments": true, "spend": true}'::jsonb,
  cover_path   text,                                 -- "<trip_id>/cover-<uuid>.jpg" in the photos bucket
  invite_code  text unique,                          -- Figma 20 "Share invite link": /join/<code>
  created_at   timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.trip_members (
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- viewer: on the trip, can rate and comment, cannot add photos (Figma 24 "Let friends add to my trips")
  role        text not null default 'contributor' check (role in ('owner', 'contributor', 'viewer')),
  status      text not null default 'invited' check (status in ('invited', 'joined')),
  invited_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- the owner joins their own trip automatically
create function public.add_trip_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_members (trip_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'joined');
  return new;
end;
$$;

create trigger on_trip_created
  after insert on public.trips
  for each row execute function public.add_trip_owner();

-- ---------------------------------------------------------------------------
-- Places and everything attached to them
-- ---------------------------------------------------------------------------

create table public.places (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  name           text not null default 'Unnamed place',
  category       text,                               -- food / nature / culture / shopping / stay / other
  lat            double precision not null check (lat between -90 and 90),
  lng            double precision not null check (lng between -180 and 180),
  first_seen_at  timestamptz,
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index places_trip_idx on public.places (trip_id);

create table public.photos (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips (id) on delete cascade,
  place_id         uuid references public.places (id) on delete set null,
  uploaded_by      uuid not null references public.profiles (id) on delete cascade,
  storage_path     text not null unique,              -- "<trip_id>/<uuid>.jpg"
  taken_at         timestamptz,
  lat              double precision check (lat is null or lat between -90 and 90),
  lng              double precision check (lng is null or lng between -180 and 180),
  -- where the coordinates came from. 'none' means the user still has to place it —
  -- we never infer a location from a neighbouring photo.
  location_source  text not null default 'none' check (location_source in ('exif', 'device', 'manual', 'none')),
  width            int,
  height           int,
  created_at       timestamptz not null default now(),
  check ((location_source = 'none') = (lat is null and lng is null))
);
create index photos_trip_idx on public.photos (trip_id);
create index photos_place_idx on public.photos (place_id);

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  place_id     uuid references public.places (id) on delete cascade,
  paid_by      uuid not null references public.profiles (id) on delete cascade,
  amount       numeric(12, 2) not null check (amount >= 0),
  currency     text not null default 'MYR',
  amount_myr   numeric(12, 2),                       -- converted at that day's ECB rate; null if conversion failed
  label        text,
  split_count  int not null default 1 check (split_count >= 1),
  created_at   timestamptz not null default now()
);
create index expenses_trip_idx on public.expenses (trip_id);

create table public.ratings (
  place_id    uuid not null references public.places (id) on delete cascade,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  updated_at  timestamptz not null default now(),
  primary key (place_id, user_id)
);

create table public.notes (
  place_id    uuid not null references public.places (id) on delete cascade,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text not null default '',
  ai_drafted  boolean not null default false,      -- "Ato drafted this — tap to edit"
  updated_at  timestamptz not null default now(),
  primary key (place_id, user_id)
);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references public.places (id) on delete cascade,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index comments_place_idx on public.comments (place_id);

-- ---------------------------------------------------------------------------
-- AI output
-- ---------------------------------------------------------------------------

create table public.memory_books (
  trip_id       uuid primary key references public.trips (id) on delete cascade,
  content       jsonb not null,                    -- pages, observations, spend split
  model         text,
  generated_at  timestamptz not null default now()
);

-- server-only: written with the service-role key, never from the browser
create table public.llm_cache (
  prompt_hash  text primary key,
  response     jsonb not null,
  created_at   timestamptz not null default now()
);

-- planner stops (Figma 35, 31). source 'user' = the traveller's must-visit, never dropped;
-- source 'ato' = filled in by the planner from real OpenStreetMap places.
create table public.plan_stops (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  added_by      uuid references public.profiles (id) on delete set null,
  name          text not null,
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  category      text,
  source        text not null default 'user' check (source in ('user', 'ato')),
  priority      int,                                 -- the order the traveller put their must-visits in (Figma 35)
  reason        text,                                -- why Ato picked it
  fixed_day     int check (fixed_day is null or fixed_day between 1 and 30),
  fixed_time    time,
  day           int,
  position      int,
  start_time    time,
  duration_min  int,
  osm_ref       text,
  created_at    timestamptz not null default now()
);
create index plan_stops_trip_idx on public.plan_stops (trip_id);

-- OpenStreetMap points of interest around a destination, fetched once from Overpass
create table public.poi_cache (
  key         text primary key,                      -- lat,lng rounded to 2 decimals
  pois        jsonb not null,
  created_at  timestamptz not null default now()
);

-- Figma 18 "Who was there" — the people at a place
create table public.place_people (
  place_id  uuid not null references public.places (id) on delete cascade,
  trip_id   uuid not null references public.trips (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  primary key (place_id, user_id)
);

-- Community (Figma 23, 23b): likes, saves, follows, messages
create table public.likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, trip_id)
);
create table public.saves (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, trip_id)
);
create table public.follows (
  follower    uuid not null references public.profiles (id) on delete cascade,
  followee    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender      uuid not null references public.profiles (id) on delete cascade,
  recipient   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  check (sender <> recipient)
);
create index messages_recipient_idx on public.messages (recipient, read_at);
create index messages_pair_idx on public.messages (sender, recipient, created_at);

-- reverse-geocoding cache (Nominatim allows 1 request per second — never ask twice)
create table public.geocode_cache (
  key         text primary key,                      -- lat,lng rounded to 4 decimals (~11 m)
  name        text not null,
  category    text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers. SECURITY DEFINER lets policies ask about membership without
-- triggering RLS on trip_members again (which would recurse).
-- ---------------------------------------------------------------------------

-- joined members: can read and write the trip's memories
create function public.is_trip_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = t and user_id = auth.uid() and status = 'joined'
  );
$$;

-- joined or merely invited: can see the trip exists, so they can accept
create function public.has_trip_access(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = t and user_id = auth.uid()
  );
$$;

create function public.is_trip_owner(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = t and owner_id = auth.uid());
$$;

-- joined, and allowed to add photos
create function public.can_add_photos(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = t and user_id = auth.uid() and status = 'joined' and role in ('owner', 'contributor')
  );
$$;

-- Figma 22c: find someone by @username or by their exact email, without exposing anyone's email
create function public.find_profile(q text) returns table (id uuid, display_name text, username text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id <> auth.uid()
    and (p.username = lower(ltrim(trim(q), '@')) or (position('@' in trim(q)) > 1 and lower(u.email) = lower(trim(q))))
  limit 1;
$$;
revoke all on function public.find_profile(text) from public;
-- Supabase grants every new function to anon by default, so revoking from public alone isn't enough
revoke all on function public.find_profile(text) from anon;
grant execute on function public.find_profile(text) to authenticated;

-- The shared demo accounts (…@demo.tabiato.app) can't delete shared data, even by calling the API
-- directly. The nightly reset runs with the service role (auth.uid() is null), so it is unaffected.
create function public.is_demo_session() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users where id = auth.uid() and lower(email) like '%@demo.tabiato.app');
$$;

create function public.guard_demo_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_demo_session() then
    -- declining an invite or a friend request is still fine; removing shared things is not
    if tg_table_name = 'trip_members' and old.status <> 'joined' then return old; end if;
    if tg_table_name = 'friendships' and old.status <> 'accepted' then return old; end if;
    raise exception 'The demo account can''t delete — it resets every night';
  end if;
  return old;
end;
$$;

create function public.is_trip_public(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = t and is_public);
$$;

-- you and `other` are accepted friends
create function public.is_friend(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where status = 'accepted'
                 and ((requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid())));
$$;

-- someone who isn't on the trip may see it: public, or friends-only and you are the owner's friend
create function public.is_trip_visible(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips
                 where id = t and (is_public or (friends_can_view and public.is_friend(owner_id))));
$$;

-- visible to you (public, or friends-only and you are a friend) AND the owner left this part on
create function public.is_trip_shared(t uuid, part text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trips
    where id = t and (is_public or (friends_can_view and public.is_friend(owner_id)))
      and coalesce((share_settings ->> part)::boolean, true)
  );
$$;

-- Figma 36a "What you spent — totals only": category totals in MYR, never receipts or labels
create function public.public_trip_spend(t uuid) returns table (category text, amount numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(p.category, 'other'), sum(coalesce(e.amount_myr, case when e.currency = 'MYR' then e.amount end))
  from public.expenses e left join public.places p on p.id = e.place_id
  where e.trip_id = t and (public.is_trip_member(t) or public.is_trip_shared(t, 'spend'))
  group by 1;
$$;

-- you may message friends, and people who publish trips (Figma 23b "Message Max")
create function public.can_message(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where status = 'accepted'
                 and ((requester = auth.uid() and addressee = r) or (requester = r and addressee = auth.uid())))
      or exists (select 1 from public.trips where owner_id = r and is_public);
$$;

-- a recipient may only mark a message read, never rewrite it
create function public.guard_message_update() returns trigger
language plpgsql as $$
begin
  if new.body is distinct from old.body or new.sender is distinct from old.sender
     or new.recipient is distinct from old.recipient or new.created_at is distinct from old.created_at then
    raise exception 'messages can only be marked read';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.friendships   enable row level security;
alter table public.trips         enable row level security;
alter table public.trip_members  enable row level security;
alter table public.places        enable row level security;
alter table public.photos        enable row level security;
alter table public.expenses      enable row level security;
alter table public.ratings       enable row level security;
alter table public.notes         enable row level security;
alter table public.comments      enable row level security;
alter table public.memory_books  enable row level security;
alter table public.llm_cache     enable row level security;   -- no policies: service role only
alter table public.geocode_cache enable row level security;
alter table public.plan_stops    enable row level security;
alter table public.likes         enable row level security;
alter table public.place_people  enable row level security;
alter table public.saves         enable row level security;
alter table public.follows       enable row level security;
alter table public.messages      enable row level security;
create trigger messages_read_only before update on public.messages for each row execute function public.guard_message_update();
create trigger trips_demo_guard before delete on public.trips for each row execute function public.guard_demo_delete();
create trigger members_demo_guard before delete on public.trip_members for each row execute function public.guard_demo_delete();
create trigger friendships_demo_guard before delete on public.friendships for each row execute function public.guard_demo_delete();
revoke all on function public.public_trip_spend(uuid) from public;
revoke all on function public.public_trip_spend(uuid) from anon;
grant execute on function public.public_trip_spend(uuid) to authenticated;
alter table public.poi_cache     enable row level security;

-- profiles: any signed-in user can see names and avatars; you edit only your own
create policy "profiles: read" on public.profiles
  for select to authenticated using (true);
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- friendships: both sides see it; requester creates; addressee accepts; either removes
create policy "friendships: read own" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));
create policy "friendships: request" on public.friendships
  for insert to authenticated with check (requester = auth.uid() and status = 'pending');
create policy "friendships: accept" on public.friendships
  for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy "friendships: remove" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

-- trips
-- owner_id = auth.uid() matters: an insert that returns the new row is checked before the
-- "add the owner as a member" trigger runs, so without it creating a trip would fail
create policy "trips: read" on public.trips
  for select to authenticated using (owner_id = auth.uid() or public.has_trip_access(id) or is_public
                                     or (friends_can_view and public.is_friend(owner_id)));
create policy "trips: create own" on public.trips
  for insert to authenticated with check (owner_id = auth.uid());
create policy "trips: owner edits" on public.trips
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "trips: owner deletes" on public.trips
  for delete to authenticated using (owner_id = auth.uid());

-- trip_members: owner invites; you accept your own invite; you can leave; owner can remove
create policy "members: read" on public.trip_members
  for select to authenticated using (user_id = auth.uid() or public.is_trip_member(trip_id));
create policy "members: owner invites" on public.trip_members
  for insert to authenticated
  with check (public.is_trip_owner(trip_id) and role in ('contributor', 'viewer') and status = 'invited');
create policy "members: accept own invite" on public.trip_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role in ('contributor', 'viewer'));
-- only the trip owner may change anyone's role; a policy can't see the old value, so a trigger guards it
create function public.guard_member_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_trip_owner(new.trip_id) then
    raise exception 'only the trip owner can change roles';
  end if;
  return new;
end;
$$;
create trigger trip_members_role_guard
  before update on public.trip_members
  for each row execute function public.guard_member_role();

-- the owner decides who may add photos (Figma 21 "•••")
create policy "members: owner sets roles" on public.trip_members
  for update to authenticated
  using (public.is_trip_owner(trip_id) and user_id <> auth.uid())
  with check (role in ('contributor', 'viewer'));
create policy "members: leave or remove" on public.trip_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_trip_owner(trip_id));

-- places and photos: members read and add; public trips are readable by anyone signed in,
-- friends-only trips by the owner's friends
create policy "places: read" on public.places
  for select to authenticated using (public.is_trip_member(trip_id) or public.is_trip_visible(trip_id));
create policy "places: members write" on public.places
  for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

create policy "photos: read" on public.photos
  for select to authenticated using (public.is_trip_member(trip_id) or public.is_trip_shared(trip_id, 'photos'));
create policy "photos: members upload" on public.photos
  for insert to authenticated with check (public.can_add_photos(trip_id) and uploaded_by = auth.uid());
create policy "photos: uploader or owner edits" on public.photos
  for update to authenticated
  using (uploaded_by = auth.uid() or public.is_trip_owner(trip_id))
  with check (public.is_trip_member(trip_id));
create policy "photos: uploader or owner deletes" on public.photos
  for delete to authenticated using (uploaded_by = auth.uid() or public.is_trip_owner(trip_id));

-- expenses: members only (public sharing shows totals later, via a view)
create policy "expenses: members" on public.expenses
  for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- ratings: members read (public trips too); you write only your own
create policy "ratings: read" on public.ratings
  for select to authenticated using (public.is_trip_member(trip_id) or public.is_trip_shared(trip_id, 'ratings'));
create policy "ratings: write own" on public.ratings
  for all to authenticated
  using (user_id = auth.uid() and public.is_trip_member(trip_id))
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

-- notes: never public — trip members only
create policy "notes: members read" on public.notes
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "notes: write own" on public.notes
  for all to authenticated
  using (user_id = auth.uid() and public.is_trip_member(trip_id))
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

-- comments
create policy "comments: read" on public.comments
  for select to authenticated using (public.is_trip_member(trip_id) or public.is_trip_shared(trip_id, 'comments'));
create policy "comments: members post" on public.comments
  for insert to authenticated with check (user_id = auth.uid() and public.is_trip_member(trip_id));
create policy "comments: delete own" on public.comments
  for delete to authenticated using (user_id = auth.uid());

-- geocode cache holds only public place names — any signed-in user may read and add
create policy "geocode: read" on public.geocode_cache for select to authenticated using (true);
create policy "geocode: add" on public.geocode_cache for insert to authenticated with check (true);

create policy "poi: read" on public.poi_cache for select to authenticated using (true);
create policy "poi: add" on public.poi_cache for insert to authenticated with check (true);

-- plan stops: the whole group edits the plan together
create policy "stops: members" on public.plan_stops
  for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

create policy "place people: members" on public.place_people
  for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- Figma 20: joining by invite link. Security definer so the link works without the owner present;
-- the role follows the owner's "Let friends add to my trips" switch.
create function public.join_trip(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into t from public.trips where invite_code = code;
  if t.id is null then return null; end if;
  insert into public.trip_members (trip_id, user_id, role, status, invited_by)
  values (t.id, auth.uid(),
          case when coalesce((select (settings ->> 'friends_can_add')::boolean from public.profiles where id = t.owner_id), true)
               then 'contributor' else 'viewer' end,
          'joined', t.owner_id)
  on conflict (trip_id, user_id) do update set status = 'joined';
  return t.id;
end;
$$;
revoke all on function public.join_trip(text) from public;
revoke all on function public.join_trip(text) from anon;
grant execute on function public.join_trip(text) to authenticated;

create policy "likes: read" on public.likes for select to authenticated using (user_id = auth.uid() or public.is_trip_visible(trip_id));
create policy "likes: add own" on public.likes for insert to authenticated with check (user_id = auth.uid() and public.is_trip_visible(trip_id));
create policy "likes: remove own" on public.likes for delete to authenticated using (user_id = auth.uid());
create policy "saves: own" on public.saves for select to authenticated using (user_id = auth.uid());
create policy "saves: add own" on public.saves for insert to authenticated with check (user_id = auth.uid() and public.is_trip_visible(trip_id));
create policy "saves: remove own" on public.saves for delete to authenticated using (user_id = auth.uid());
create policy "follows: read" on public.follows for select to authenticated using (true);
create policy "follows: add own" on public.follows for insert to authenticated with check (follower = auth.uid());
create policy "follows: remove own" on public.follows for delete to authenticated using (follower = auth.uid());
create policy "messages: own" on public.messages for select to authenticated using (auth.uid() in (sender, recipient));
create policy "messages: send" on public.messages for insert to authenticated with check (sender = auth.uid() and public.can_message(recipient));
create policy "messages: mark read" on public.messages for update to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());

-- memory books
-- the book is made of photos, so it is public only when photos are
create policy "books: read" on public.memory_books
  for select to authenticated using (public.is_trip_member(trip_id) or public.is_trip_shared(trip_id, 'photos'));
create policy "books: members write" on public.memory_books
  for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- ---------------------------------------------------------------------------
-- Photo storage. Objects live at  photos/<trip_id>/<file>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- profile photos (Figma 04 "Add a photo"): public to read, each person writes only their own folder
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
create policy "avatars: read" on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "avatars: own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "avatars: replace own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

-- first folder of the object path is the trip id; anything else is refused, never errors
create function public.trip_id_from_path(p text) returns uuid
language sql immutable as $$
  select case
    when split_part(p, '/', 1) ~ '^[0-9a-fA-F-]{36}$' then split_part(p, '/', 1)::uuid
  end;
$$;

create policy "photo files: read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (public.is_trip_member(public.trip_id_from_path(name))
         or public.is_trip_shared(public.trip_id_from_path(name), 'photos'))
  );

create policy "photo files: members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.can_add_photos(public.trip_id_from_path(name)));

-- who uploaded a file, from our own photos table — doesn't depend on storage.objects.owner,
-- which hosted Supabase has deprecated in favour of owner_id
create function public.uploaded_photo(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.photos where storage_path = p and uploaded_by = auth.uid());
$$;

create policy "photo files: uploader or trip owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (public.uploaded_photo(name) or public.is_trip_owner(public.trip_id_from_path(name))));

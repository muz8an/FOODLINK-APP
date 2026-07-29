-- ============================================================
-- FoodLink - Complete Database Schema
-- Run this entire file ONCE in your Supabase SQL Editor.
-- It is idempotent (safe to re-run).
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text not null default 'FoodLink Member',
  role            text not null default 'donor'
                    check (role in ('donor','ngo','volunteer','admin')),
  organization_name text,
  phone           text,
  verified        boolean not null default false,
  points          integer not null default 0,
  rank            text not null default 'Bronze',
  streak          integer not null default 0,
  lat             double precision not null default 12.9716,
  lng             double precision not null default 77.5946,
  avatar_url      text,
  address         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes for fast lookups
create index if not exists idx_profiles_role      on public.profiles(role);
create index if not exists idx_profiles_points    on public.profiles(points desc);
create index if not exists idx_profiles_verified  on public.profiles(verified);
create index if not exists idx_profiles_location  on public.profiles(lat, lng);

-- Normalize any existing profile roles to lowercase to match app expectations
update public.profiles
set role = lower(role)
where role is not null and role <> lower(role);

-- ============================================================
-- 2. DONATIONS TABLE (includes all missing columns)
-- ============================================================
create table if not exists public.donations (
  id              uuid primary key default uuid_generate_v4(),
  donor_id        uuid not null references public.profiles(id) on delete cascade,
  food_name       text not null,
  category        text,
  veg_type        text check (veg_type in ('veg','non-veg','vegan')),
  quantity_kg     numeric,
  servings        integer,
  expiry_at       timestamptz,
  pickup_address  text,
  lat             double precision,
  lng             double precision,
  contact_phone   text,
  notes           text,
  images          text[] default '{}',
  status          text not null default 'pending'
                    check (status in ('pending','accepted','volunteer_assigned',
                                      'picked_up','delivered','completed','cancelled')),
  accepted_by     uuid references public.profiles(id) on delete set null,
  volunteer_id    uuid references public.profiles(id) on delete set null,
  points_awarded  integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_donations_donor     on public.donations(donor_id);
create index if not exists idx_donations_status    on public.donations(status);
create index if not exists idx_donations_accepted  on public.donations(accepted_by);
create index if not exists idx_donations_volunteer on public.donations(volunteer_id);
create index if not exists idx_donations_created   on public.donations(created_at desc);
create index if not exists idx_donations_location  on public.donations(lat, lng);
create index if not exists idx_donations_expiry    on public.donations(expiry_at);

-- ============================================================
-- 3. EMERGENCY REQUESTS
-- ============================================================
create table if not exists public.emergency_requests (
  id              uuid primary key default uuid_generate_v4(),
  ngo_id          uuid not null references public.profiles(id) on delete cascade,
  ngo_name        text,
  location        text,
  lat             double precision,
  lng             double precision,
  meals_needed    integer not null default 0,
  priority        text check (priority in ('low','medium','high','critical')),
  description     text,
  status          text default 'active',
  fulfilled       integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_emergency_ngo      on public.emergency_requests(ngo_id);
create index if not exists idx_emergency_priority on public.emergency_requests(priority);
create index if not exists idx_emergency_status   on public.emergency_requests(status);

-- ============================================================
-- 4. NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  title           text,
  body            text,
  type            text,
  link            text,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_notifs_user       on public.notifications(user_id);
create index if not exists idx_notifs_unread     on public.notifications(user_id, read) where read = false;
create index if not exists idx_notifs_created    on public.notifications(created_at desc);

-- ============================================================
-- 5. CHAT THREADS
-- ============================================================
create table if not exists public.chat_threads (
  id              uuid primary key default uuid_generate_v4(),
  donation_id     uuid references public.donations(id) on delete set null,
  donor_id        uuid references public.profiles(id)  on delete set null,
  ngo_id          uuid references public.profiles(id)  on delete set null,
  volunteer_id    uuid references public.profiles(id)  on delete set null,
  last_message_at timestamptz default now(),
  created_at      timestamptz default now()
);

create index if not exists idx_threads_donation on public.chat_threads(donation_id);

-- ============================================================
-- 6. CHAT MESSAGES
-- ============================================================
create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.chat_threads(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  text            text,
  image_url       text,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_messages_thread on public.chat_messages(thread_id, created_at);
create index if not exists idx_messages_sender on public.chat_messages(sender_id);

-- ============================================================
-- 7. REVIEWS
-- ============================================================
create table if not exists public.reviews (
  id              uuid primary key default uuid_generate_v4(),
  donation_id     uuid references public.donations(id) on delete cascade,
  reviewer_id     uuid references public.profiles(id)  on delete cascade,
  rating          integer check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz default now()
);

-- ============================================================
-- 8. USER BADGES (many-to-many)
-- ============================================================
create table if not exists public.user_badges (
  user_id         uuid references public.profiles(id) on delete cascade,
  badge_key       text not null,
  earned_at       timestamptz default now(),
  primary key (user_id, badge_key)
);

-- ============================================================
-- 9. DELIVERIES (audit trail)
-- ============================================================
create table if not exists public.deliveries (
  id              uuid primary key default uuid_generate_v4(),
  donation_id     uuid references public.donations(id) on delete cascade,
  volunteer_id    uuid references public.profiles(id)  on delete set null,
  qr_code         text,
  pickup_proof_url  text,
  delivery_proof_url text,
  picked_up_at    timestamptz,
  delivered_at    timestamptz,
  distance_km     numeric,
  created_at      timestamptz default now()
);

-- ============================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.donations          enable row level security;
alter table public.emergency_requests enable row level security;
alter table public.notifications      enable row level security;
alter table public.chat_threads       enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.reviews            enable row level security;
alter table public.user_badges        enable row level security;
alter table public.deliveries         enable row level security;

-- Drop existing policies safely
drop policy if exists "profiles_read_public"          on public.profiles;
drop policy if exists "profiles_insert_own"           on public.profiles;
drop policy if exists "profiles_update_own"           on public.profiles;

drop policy if exists "donations_read_public"         on public.donations;
drop policy if exists "donations_insert_own"          on public.donations;
drop policy if exists "donations_update_owner"        on public.donations;
drop policy if exists "donations_update_ngo"          on public.donations;
drop policy if exists "donations_update_volunteer"    on public.donations;

drop policy if exists "emergency_read_public"         on public.emergency_requests;
drop policy if exists "emergency_insert_ngo"          on public.emergency_requests;

drop policy if exists "notifs_read_own"               on public.notifications;
drop policy if exists "notifs_insert_any_auth"        on public.notifications;
drop policy if exists "notifs_update_own"             on public.notifications;

drop policy if exists "threads_read_any_auth"         on public.chat_threads;
drop policy if exists "threads_insert_any_auth"       on public.chat_threads;

drop policy if exists "messages_read_any_auth"        on public.chat_messages;
drop policy if exists "messages_insert_any_auth"      on public.chat_messages;

drop policy if exists "reviews_read_public"           on public.reviews;
drop policy if exists "reviews_insert_own"            on public.reviews;

drop policy if exists "badges_read_public"            on public.user_badges;
drop policy if exists "badges_insert_own"             on public.user_badges;

drop policy if exists "deliveries_read_own"           on public.deliveries;
drop policy if exists "deliveries_insert_own"         on public.deliveries;

-- PROFILES
create policy "profiles_read_public" on public.profiles
  for select using (true);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- DONATIONS
create policy "donations_read_public" on public.donations
  for select using (true);

create policy "donations_insert_own" on public.donations
  for insert with check (auth.uid() = donor_id);

create policy "donations_update_owner" on public.donations
  for update using (auth.uid() = donor_id);

create policy "donations_update_ngo" on public.donations
  for update using (auth.uid() = accepted_by or accepted_by is null);

create policy "donations_update_volunteer" on public.donations
  for update using (auth.uid() = volunteer_id or volunteer_id is null);

-- EMERGENCY
create policy "emergency_read_public" on public.emergency_requests
  for select using (true);

create policy "emergency_insert_ngo" on public.emergency_requests
  for insert with check (auth.uid() = ngo_id);

-- NOTIFICATIONS
create policy "notifs_read_own" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifs_insert_any_auth" on public.notifications
  for insert with check (auth.role() = 'authenticated');

create policy "notifs_update_own" on public.notifications
  for update using (auth.uid() = user_id);

-- CHAT THREADS
create policy "threads_read_any_auth" on public.chat_threads
  for select using (auth.role() = 'authenticated');

create policy "threads_insert_any_auth" on public.chat_threads
  for insert with check (auth.role() = 'authenticated');

-- CHAT MESSAGES
create policy "messages_read_any_auth" on public.chat_messages
  for select using (auth.role() = 'authenticated');

create policy "messages_insert_any_auth" on public.chat_messages
  for insert with check (auth.uid() = sender_id);

-- REVIEWS
create policy "reviews_read_public" on public.reviews
  for select using (true);

create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid() = reviewer_id);

-- BADGES
create policy "badges_read_public" on public.user_badges
  for select using (true);

create policy "badges_insert_own" on public.user_badges
  for insert with check (auth.uid() = user_id);

-- DELIVERIES
create policy "deliveries_read_own" on public.deliveries
  for select using (auth.uid() = volunteer_id);

create policy "deliveries_insert_own" on public.deliveries
  for insert with check (auth.uid() = volunteer_id);

-- ============================================================
-- 11. TRIGGER: Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, role, verified, points, rank, streak, lat, lng
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'FoodLink Member'),
      lower(coalesce(new.raw_user_meta_data->>'role', 'donor')),
    coalesce((new.raw_user_meta_data->>'verified')::boolean, false),
    coalesce((new.raw_user_meta_data->>'points')::integer, 0),
    coalesce(new.raw_user_meta_data->>'rank', 'Bronze'),
    coalesce((new.raw_user_meta_data->>'streak')::integer, 0),
    coalesce((new.raw_user_meta_data->>'lat')::double precision, 12.9716),
    coalesce((new.raw_user_meta_data->>'lng')::double precision, 77.5946)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 12. FUNCTIONS: Increment points atomically
-- ============================================================
create or replace function public.increment_points(user_id uuid, pts integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    points = points + pts,
    rank = case
      when (points + pts) >= 1500 then 'Diamond'
      when (points + pts) >= 900  then 'Platinum'
      when (points + pts) >= 500  then 'Gold'
      when (points + pts) >= 220  then 'Silver'
      else 'Bronze'
    end,
    updated_at = now()
  where id = user_id;
end;
$$;

-- ============================================================
-- 13. REALTIME PUBLICATION
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.donations;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.emergency_requests;
alter publication supabase_realtime add table public.profiles;

-- ============================================================
-- 14. STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public)
values ('food-images', 'food-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('delivery-proofs', 'delivery-proofs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do nothing;

-- Storage policies
drop policy if exists "public_read_food_images"   on storage.objects;
drop policy if exists "auth_upload_food_images"   on storage.objects;
drop policy if exists "public_read_delivery_proofs" on storage.objects;
drop policy if exists "auth_upload_delivery_proofs" on storage.objects;
drop policy if exists "public_read_profile_pics"  on storage.objects;
drop policy if exists "auth_upload_profile_pics"  on storage.objects;

create policy "public_read_food_images"    on storage.objects for select using (bucket_id = 'food-images');
create policy "auth_upload_food_images"    on storage.objects for insert with check (bucket_id = 'food-images' and auth.role() = 'authenticated');
create policy "public_read_delivery_proofs" on storage.objects for select using (bucket_id = 'delivery-proofs');
create policy "auth_upload_delivery_proofs" on storage.objects for insert with check (bucket_id = 'delivery-proofs' and auth.role() = 'authenticated');
create policy "public_read_profile_pics"  on storage.objects for select using (bucket_id = 'profile-pictures');
create policy "auth_upload_profile_pics"  on storage.objects for insert with check (bucket_id = 'profile-pictures' and auth.role() = 'authenticated');

-- ============================================================
-- DONE. All tables, RLS, triggers, functions, realtime and
-- storage are now configured correctly.
-- ============================================================

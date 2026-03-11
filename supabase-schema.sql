-- ─────────────────────────────────────────────────────────────────
-- TERRAGEN — Supabase Schema
-- Paste this into: Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Territories table
create table if not exists territories (
  id            uuid primary key default uuid_generate_v4(),
  seed          integer       not null,
  tier          text          not null,
  col           integer       not null,
  row           integer       not null,
  params        jsonb         not null default '{}',
  biomes        integer[]     not null default '{}',  -- array of 0-6 biome indices
  png_url       text,
  json_url      text,
  agent_address text,
  dominant_biome text,
  tx_hash       text,
  vm_id         text,
  claimed_at    timestamptz   not null default now()
);

-- Unique constraint: one territory per grid cell
alter table territories
  add constraint territories_col_row_unique unique (col, row);

-- Index for fast world map queries
create index if not exists territories_claimed_at_idx on territories (claimed_at desc);
create index if not exists territories_agent_idx on territories (agent_address);

-- ─── Row Level Security ───────────────────────────────────────────
alter table territories enable row level security;

-- Anyone can read territories (public world map)
create policy "Public read"
  on territories for select
  using (true);

-- Only service role can insert/update (via server-side API routes)
-- Note: inserts from API routes use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
-- This policy blocks direct client-side inserts for safety
create policy "Service role insert"
  on territories for insert
  with check (false);  -- blocked for anon/authenticated; service role bypasses this

-- ─── Realtime ────────────────────────────────────────────────────
-- Enable realtime on territories table
-- Go to: Supabase Dashboard → Database → Replication → territories → enable

-- ─────────────────────────────────────────────────────────────────
-- Done! Your table is ready.
-- Next: copy .env.example to .env and fill in:
--   NEXT_PUBLIC_SUPABASE_URL     → Project Settings → API → Project URL
--   NEXT_PUBLIC_SUPABASE_ANON_KEY → Project Settings → API → anon public key
--   SUPABASE_SERVICE_ROLE_KEY    → Project Settings → API → service_role secret key
-- ─────────────────────────────────────────────────────────────────

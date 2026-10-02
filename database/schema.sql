-- FC Scanner schema draft. Apply once to the selected Supabase project.
-- No account/auth settings or existing application tables are changed.
begin;
create schema fcscanner;
create table fcscanner.cards (
 game text not null check (game = 'fc27'),
 card_id text not null,
 name text not null,
 version text not null,
 rating smallint check (rating between 1 and 99),
 category text not null default 'unknown' check (category in ('unknown','fodder','playable')),
 source_url text,
 created_at timestamptz not null default now(),
 primary key (game, card_id)
);
create table fcscanner.price_observations (
 game text not null,
 card_id text not null,
 platform text not null check (platform = 'pc'),
 observed_at timestamptz not null,
 price integer not null check (price >= 150),
 source text not null,
 ingested_at timestamptz not null default now(),
 primary key (game, card_id, platform, observed_at),
 foreign key (game, card_id) references fcscanner.cards(game, card_id)
);
create index price_observations_recent on fcscanner.price_observations(observed_at desc);
create table fcscanner.market_events (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 type text not null check (type in ('packs','rewards','promo','sbc','evo')),
 scope text not null check (scope in ('all','cards','fodder','playable')),
 card_ids text[] not null default '{}',
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 source_url text,
 created_at timestamptz not null default now(),
 check (ends_at > starts_at),
 check (scope <> 'cards' or cardinality(card_ids) > 0)
);
create index market_events_window on fcscanner.market_events(ends_at, starts_at);
create table fcscanner.signals (
 id uuid primary key default gen_random_uuid(),
 game text not null,
 card_id text not null,
 platform text not null check (platform = 'pc'),
 generated_at timestamptz not null default now(),
 model_version text not null,
 direction text not null check (direction in ('up','down','neutral','insufficient','stale')),
 reference_price integer check (reference_price >= 150),
 horizon_hours integer not null check (horizon_hours between 1 and 168),
 reasons jsonb not null default '[]' check (jsonb_typeof(reasons) = 'array'),
 foreign key (game, card_id) references fcscanner.cards(game, card_id),
 unique (game, card_id, platform, generated_at, model_version)
);
create index signals_recent on fcscanner.signals(generated_at desc);
-- Market data is public read-only. Trusted imports run server-side.
alter table fcscanner.cards enable row level security;
alter table fcscanner.price_observations enable row level security;
alter table fcscanner.market_events enable row level security;
alter table fcscanner.signals enable row level security;
revoke all on all tables in schema fcscanner from public, anon, authenticated;
grant usage on schema fcscanner to anon, authenticated, service_role;
grant select on all tables in schema fcscanner to anon, authenticated;
grant all on all tables in schema fcscanner to service_role;
create policy market_read on fcscanner.cards for select to anon, authenticated using (true);
create policy market_read on fcscanner.price_observations for select to anon, authenticated using (true);
create policy market_read on fcscanner.market_events for select to anon, authenticated using (true);
create policy market_read on fcscanner.signals for select to anon, authenticated using (true);
commit;

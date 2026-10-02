alter table fcscanner.market_events add column requirements jsonb not null default '{}'::jsonb check (jsonb_typeof(requirements)='object');
create or replace view public.fcscanner_events with (security_invoker=true) as select * from fcscanner.market_events;

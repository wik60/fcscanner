create view public.fcscanner_prices with (security_invoker=true) as select p.game,p.card_id,p.platform,p.observed_at as updated_at,p.price as market_price,c.name,c.version,c.category,c.rating,c.source_url from fcscanner.price_observations p join fcscanner.cards c using(game,card_id);
create view public.fcscanner_events with (security_invoker=true) as select * from fcscanner.market_events;
revoke all on public.fcscanner_prices,public.fcscanner_events from public,anon,authenticated;
grant select on public.fcscanner_prices,public.fcscanner_events to anon,authenticated;

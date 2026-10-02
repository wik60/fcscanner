create function public.import_fcscanner_prices(cards jsonb, prices jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into fcscanner.cards(game,card_id,name,version,source_url)
 select game,card_id,name,version,source_url from jsonb_to_recordset(cards) as c(game text,card_id text,name text,version text,source_url text)
 on conflict (game,card_id) do nothing;
 insert into fcscanner.price_observations(game,card_id,platform,observed_at,price,source)
 select game,card_id,platform,observed_at,price,source from jsonb_to_recordset(prices) as p(game text,card_id text,platform text,observed_at timestamptz,price integer,source text)
 on conflict (game,card_id,platform,observed_at) do nothing;
end;
$$;
revoke all on function public.import_fcscanner_prices(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.import_fcscanner_prices(jsonb,jsonb) to service_role;

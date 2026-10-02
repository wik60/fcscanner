create table fcscanner.collector_tokens(token_hash text primary key, label text not null, active boolean not null default true, created_at timestamptz not null default now(), last_upload timestamptz);
alter table fcscanner.collector_tokens enable row level security;
revoke all on fcscanner.collector_tokens from public,anon,authenticated;
create function public.fcscanner_upload(collector_token text, observations jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare item jsonb; ident text; observed timestamptz; price integer; total integer:=0; token_row fcscanner.collector_tokens%rowtype;
begin
 select * into token_row from fcscanner.collector_tokens where token_hash=encode(extensions.digest(collector_token,'sha256'),'hex') and active for update;
 if not found then raise exception 'Invalid collector token' using errcode='28000'; end if;
 if token_row.last_upload>now()-interval '5 seconds' then raise exception 'Wait before retrying';end if;
 if jsonb_typeof(observations)<>'array' or jsonb_array_length(observations) not between 1 and 100 then raise exception 'Invalid batch';end if;
 for item in select * from jsonb_array_elements(observations) loop
 ident:=item->>'card_id';observed:=(item->>'updated_at')::timestamptz;price:=(item->>'market_price')::integer;
 if item->>'game'<>'fc27' or item->>'platform'<>'pc' or ident !~ '^[0-9]+$' or (item->>'source_url') !~ ('^https://www[.]futbin[.]com/27/player/'||ident||'(/|$)') or price not between 150 and 15000000 or observed>now()+interval '1 minute' or observed<now()-interval '30 days' or length(item->>'name') not between 1 and 150 then raise exception 'Invalid PC observation';end if;
 if ident is null or observed is null or price is null or item->>'name' is null or item->>'source_url' is null or item->>'game' is null or item->>'platform' is null then raise exception 'Missing fields';end if;
 insert into fcscanner.cards(game,card_id,name,version,source_url) values('fc27',ident,item->>'name','Card '||ident,item->>'source_url') on conflict do nothing;
 insert into fcscanner.price_observations(game,card_id,platform,observed_at,price,source) values('fc27',ident,'pc',observed,price,'browser-confirmed') on conflict do nothing;
 total:=total+1;
 end loop;
 update fcscanner.collector_tokens set last_upload=now() where token_hash=token_row.token_hash;
 return total;
end;$$;
revoke all on function public.fcscanner_upload(text,jsonb) from public;
grant execute on function public.fcscanner_upload(text,jsonb) to anon,authenticated;

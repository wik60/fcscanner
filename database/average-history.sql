create table fcscanner.average_price_history (
game text not null check(game='fc27'),card_id text not null,platform text not null check(platform='pc'),
interval_kind text not null check(interval_kind in ('daily','hourly')),observed_at timestamptz not null,price integer not null check(price between 150 and 15000000),source_url text not null,ingested_at timestamptz not null default now(),
primary key(game,card_id,platform,interval_kind,observed_at),
foreign key(game,card_id) references fcscanner.cards(game,card_id));
alter table fcscanner.average_price_history enable row level security;
revoke all on fcscanner.average_price_history from public,anon,authenticated;
grant select on fcscanner.average_price_history to anon,authenticated;
grant all on fcscanner.average_price_history to service_role;
create policy market_read on fcscanner.average_price_history for select to anon,authenticated using(true);
create view public.fcscanner_average_history with(security_invoker=true) as select * from fcscanner.average_price_history;
revoke all on public.fcscanner_average_history from public,anon,authenticated;
grant select on public.fcscanner_average_history to anon,authenticated;
create function public.fcscanner_upload_history(collector_token text,card jsonb,points jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare token_row fcscanner.collector_tokens%rowtype;item jsonb;ident text;stamp timestamptz;value integer;kind text;total integer:=0;
begin
select * into token_row from fcscanner.collector_tokens where token_hash=encode(extensions.digest(collector_token,'sha256'),'hex') and active for update;
if not found then raise exception 'Invalid collector token' using errcode='28000';end if;
if token_row.last_upload>now()-interval '5 seconds' then raise exception 'Wait before retrying';end if;
ident:=card->>'card_id';
if ident is null or ident !~ '^[0-9]+$' or card->>'game' is distinct from 'fc27' or card->>'platform' is distinct from 'pc' or card->>'source_url' is null or card->>'source_url' !~ ('^https://www[.]futbin[.]com/27/player/'||ident||'(/|$)') or card->>'name' is null or length(card->>'name') not between 1 and 150 then raise exception 'Invalid card';end if;
if points is null or jsonb_typeof(points)<>'array' or jsonb_array_length(points) not between 1 and 5000 then raise exception 'Invalid points';end if;
insert into fcscanner.cards(game,card_id,name,version,source_url) values('fc27',ident,card->>'name','Card '||ident,card->>'source_url') on conflict do nothing;
for item in select * from jsonb_array_elements(points) loop
stamp:=(item->>'updated_at')::timestamptz;value:=(item->>'price')::integer;kind:=item->>'kind';
if stamp is null or value is null or kind is null or kind not in ('daily','hourly') or value not between 150 and 15000000 or stamp< '2026-01-01'::timestamptz or stamp>now()+interval '1 minute' then raise exception 'Invalid historical point';end if;
insert into fcscanner.average_price_history(game,card_id,platform,interval_kind,observed_at,price,source_url) values('fc27',ident,'pc',kind,stamp,value,card->>'source_url') on conflict do nothing;
total:=total+1;
end loop;
update fcscanner.collector_tokens set last_upload=now() where token_hash=token_row.token_hash;
return total;
end;$$;
revoke all on function public.fcscanner_upload_history(text,jsonb,jsonb) from public;
grant execute on function public.fcscanner_upload_history(text,jsonb,jsonb) to anon,authenticated;

with token as (select 'fc_'||encode(extensions.gen_random_bytes(32),'hex') as value)
insert into fcscanner.collector_tokens(token_hash,label)
select encode(extensions.digest(value,'sha256'),'hex'),'Opera GX' from token
returning (select value from token) as collector_token;
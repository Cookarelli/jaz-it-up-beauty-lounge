-- Shared atomic limits survive serverless restarts. No raw IP address is stored.
create table public.api_rate_limits (
  scope text not null,
  key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),
  window_seconds integer not null check(window_seconds in (60,3600)),
  bucket timestamptz not null,
  hits integer not null check(hits>0),
  primary key(scope,key_hash,window_seconds,bucket)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public,anon,authenticated;
grant all on public.api_rate_limits to service_role;
create index api_rate_limits_cleanup on public.api_rate_limits(bucket);
create function public.consume_api_limit(p_scope text,p_key text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare per_minute integer; per_hour integer; n integer; duration integer; limit_value integer; slot timestamptz; allowed boolean=true;
begin
  case p_scope
    when 'bookings' then per_minute=5;per_hour=20;
    when 'availability' then per_minute=60;per_hour=300;
    when 'status' then per_minute=90;per_hour=900;
    when 'cancel' then per_minute=10;per_hour=40;
    when 'preferences' then per_minute=10;per_hour=40;
    else raise exception 'Unknown API scope';
  end case;
  if p_key !~ '^[a-f0-9]{64}$' or p_key is null then raise exception 'Invalid limit key';end if;
  foreach duration in array array[60,3600] loop
    limit_value=case when duration=60 then per_minute else per_hour end;
    slot=to_timestamp(floor(extract(epoch from now())/duration)*duration);
    insert into public.api_rate_limits(scope,key_hash,window_seconds,bucket,hits)
    values(p_scope,p_key,duration,slot,1)
    on conflict(scope,key_hash,window_seconds,bucket) do update set hits=least(public.api_rate_limits.hits+1,1000000)
    returning hits into n;
    if n>limit_value then allowed=false;end if;
  end loop;
  -- Bounded cleanup runs even when no scheduler is installed. Old hashes are not reused.
  delete from public.api_rate_limits where ctid in (select ctid from public.api_rate_limits where bucket<now()-interval '24 hours' limit 500);
  return allowed;
end $$;
revoke all on function public.consume_api_limit(text,text) from public,anon,authenticated;
grant execute on function public.consume_api_limit(text,text) to service_role;

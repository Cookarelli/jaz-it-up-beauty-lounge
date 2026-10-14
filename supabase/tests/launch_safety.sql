begin;
do $$ declare k text=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); allowed boolean;begin
 for i in 1..5 loop
  allowed=public.consume_api_limit('bookings',k);
  if not allowed then raise exception 'TEST: rate limit denied early';end if;
 end loop;
 allowed=public.consume_api_limit('bookings',k);
 if allowed then raise exception 'TEST: rate limit not enforced';end if;
 if public.consume_api_limit('availability',k) is not true then raise exception 'TEST: scope isolation failed';end if;
 insert into public.api_rate_limits values('status',k,60,now()-interval '2 days',1);
 perform public.consume_api_limit('status',k);
 if exists(select 1 from public.api_rate_limits where bucket<now()-interval '24 hours') then raise exception 'TEST: old limiter identifiers retained';end if;
end $$;
set local role anon;
do $$ declare blocked boolean=false;begin
 begin perform public.consume_api_limit('bookings',repeat('a',64)); exception when insufficient_privilege then blocked=true;end;
 if not blocked then raise exception 'TEST: anonymous limiter RPC exposed';end if;
 blocked=false;
 begin perform * from public.api_rate_limits; exception when insufficient_privilege then blocked=true;end;
 if not blocked then raise exception 'TEST: anonymous rate identifiers exposed';end if;
end $$;
reset role;
set local role authenticated;
do $$ declare blocked boolean=false;begin
 begin delete from public.api_rate_limits; exception when insufficient_privilege then blocked=true;end;
 if not blocked then raise exception 'TEST: clients can reset limiter';end if;
end $$;
reset role;
rollback;
select 'API limits, isolated scopes, identifier cleanup and private grants passed.' as result;

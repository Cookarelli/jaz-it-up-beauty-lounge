-- Apply Delia's confirmed schedule once. Later dashboard edits are authoritative.
-- Never touch existing appointments, service buffers, manual blocks, or special closures.
do $$
declare salon uuid; stylist uuid; location uuid;
begin
 select s.id,st.id,l.id into strict salon,stylist,location
 from public.salons s join public.locations l on l.salon_id=s.id
 join public.stylists st on st.location_id=l.id
 where s.name='Jaz It Up Beauty Lounge' and st.name='Delia';
 perform pg_advisory_xact_lock(hashtextextended(stylist::text,1));
 update public.salons set timezone='America/Chicago' where id=salon;
 update public.locations set timezone='America/Chicago' where id=location;
 -- The inspected project has no configured hours yet. Fail safely if another
 -- installation has conflicting open days instead of erasing later owner edits.
 if exists(select 1 from public.business_hours where salon_id=salon and weekday in (0,1))
  or exists(select 1 from public.working_hours where stylist_id=stylist and weekday in (0,1)) then
  raise exception 'Sunday/Monday working hours already exist; reconcile them in Admin > Hours & time off before applying this migration';
 end if;
 insert into public.business_hours(salon_id,weekday,opens_at,closes_at)
 select salon,day,'09:00'::time,case when day=6 then '15:00'::time else '19:00'::time end
 from generate_series(2,6) day
 on conflict(salon_id,weekday) do update set opens_at=excluded.opens_at,closes_at=excluded.closes_at;
 insert into public.working_hours(salon_id,stylist_id,weekday,opens_at,closes_at)
 select salon,stylist,day,'09:00'::time,case when day=6 then '15:00'::time else '19:00'::time end
 from generate_series(2,6) day
 on conflict(stylist_id,weekday) do update set opens_at=excluded.opens_at,closes_at=excluded.closes_at;
end $$;

-- Every offered slot includes its own preparation + service + cleanup within the
-- intersection of working hours, business hours and special opening restrictions.
-- Named timezones keep the same local opening time across DST. No lunch is inferred.
create or replace function public.available_slots(
 p_service uuid,p_date date,p_variant uuid default null,p_hold uuid default null
) returns table(starts_at timestamptz,stylist_id uuid)
language sql stable security invoker set search_path='' as $$
 with items as (
  select s.*,st.id as bookable_stylist,l.timezone,
   p.minimum_notice_minutes,p.maximum_advance_days,p.slot_interval_minutes,
   p_date::timestamp at time zone l.timezone as day_start,
   (p_date+1)::timestamp at time zone l.timezone as day_end
  from public.booking_item(p_service,p_variant) s
  join public.booking_policies p on p.salon_id=s.salon_id
  join public.locations l on l.salon_id=s.salon_id
  join public.stylists st on st.location_id=l.id and st.active
  join public.staff staff on staff.stylist_id=st.id and staff.active
  where s.active and s.status='published' and s.price_approved and s.duration_approved
   and s.duration_minutes is not null and s.price_cents is not null
   and s.pricing_type in ('exact','starting')
 ), windows as (
  select i.*,
   greatest(a.starts_at,i.day_start,(p_date+h.opens_at) at time zone i.timezone,(p_date+e.opens_at) at time zone i.timezone) as window_start,
   least(a.ends_at,i.day_end,(p_date+h.closes_at) at time zone i.timezone,(p_date+e.closes_at) at time zone i.timezone) as window_end
  from items i
  join lateral (
   select av.starts_at,av.ends_at from public.availability av
   where av.stylist_id=i.bookable_stylist and av.starts_at<i.day_end and av.ends_at>i.day_start
   union
   select (p_date+w.opens_at) at time zone i.timezone,(p_date+w.closes_at) at time zone i.timezone
   from public.working_hours w where w.stylist_id=i.bookable_stylist and w.weekday=extract(dow from p_date)
  ) a on true
  left join public.business_hours h on h.salon_id=i.salon_id and h.weekday=extract(dow from p_date)
  cross join lateral (
   select bool_or(ex.closed) as closed,max(ex.opens_at) as opens_at,min(ex.closes_at) as closes_at
   from public.schedule_exceptions ex where ex.salon_id=i.salon_id and ex.on_date=p_date
    and (ex.stylist_id is null or ex.stylist_id=i.bookable_stylist)
  ) e
  where not coalesce(e.closed,false)
   and (h.id is not null or not exists(select 1 from public.business_hours bh where bh.salon_id=i.salon_id))
 ), blockers as (
  select a.stylist_id,a.starts_at-make_interval(mins=>a.preparation_minutes) as occupied_start,
   a.ends_at+make_interval(mins=>a.cleanup_minutes) as occupied_end
  from public.appointments a join items i on i.bookable_stylist=a.stylist_id
  where a.status<>'cancelled' and a.starts_at-make_interval(mins=>a.preparation_minutes)<i.day_end
   and a.ends_at+make_interval(mins=>a.cleanup_minutes)>i.day_start
  union all
  select b.stylist_id,b.starts_at,b.ends_at from public.time_blocks b join items i on i.bookable_stylist=b.stylist_id
  where b.starts_at<i.day_end and b.ends_at>i.day_start
  union all
  select h.stylist_id,h.starts_at,h.ends_at from public.appointment_holds h join items i on i.bookable_stylist=h.stylist_id
  where h.consumed_at is null and h.expires_at>now() and (p_hold is null or h.id<>p_hold)
   and h.starts_at<i.day_end and h.ends_at>i.day_start
 )
 select distinct candidate.t,w.bookable_stylist
 from windows w cross join lateral (
  -- Keep the owner's configured start-time grid, plus exact gap boundaries.
  select generate_series(w.window_start+make_interval(mins=>w.preparation_minutes),
   w.window_end-make_interval(mins=>w.duration_minutes+w.cleanup_minutes),make_interval(mins=>w.slot_interval_minutes)) as t
  union
  select w.window_end-make_interval(mins=>w.duration_minutes+w.cleanup_minutes)
  union
  select b.occupied_end+make_interval(mins=>w.preparation_minutes) from blockers b where b.stylist_id=w.bookable_stylist
  union
  select b.occupied_start-make_interval(mins=>w.duration_minutes+w.cleanup_minutes) from blockers b where b.stylist_id=w.bookable_stylist
 ) candidate
 where candidate.t-make_interval(mins=>w.preparation_minutes)>=w.window_start
  and candidate.t+make_interval(mins=>w.duration_minutes+w.cleanup_minutes)<=w.window_end
  and (candidate.t at time zone w.timezone)::date=p_date
  and candidate.t>=now()+make_interval(mins=>w.minimum_notice_minutes)
  and candidate.t<=now()+make_interval(days=>w.maximum_advance_days)
  and not exists(select 1 from blockers b where b.stylist_id=w.bookable_stylist
   and tstzrange(b.occupied_start,b.occupied_end,'[)') &&
    tstzrange(candidate.t-make_interval(mins=>w.preparation_minutes),candidate.t+make_interval(mins=>w.duration_minutes+w.cleanup_minutes),'[)'))
 order by candidate.t;
$$;

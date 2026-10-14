begin;
-- The migration must install the exact confirmed schedule, without a lunch block.
do $$ declare salon uuid;stylist uuid;begin
 select s.id,st.id into strict salon,stylist from public.salons s join public.locations l on l.salon_id=s.id join public.stylists st on st.location_id=l.id where s.name='Jaz It Up Beauty Lounge' and st.name='Delia';
 if (select count(*) from public.business_hours where salon_id=salon)<>5 or (select count(*) from public.working_hours where stylist_id=stylist)<>5 then raise exception 'TEST: confirmed week must have exactly five open days';end if;
 if exists(select 1 from public.business_hours where salon_id=salon and (weekday not between 2 and 6 or opens_at<>'09:00'::time or closes_at<>case when weekday=6 then '15:00'::time else '19:00'::time end)) then raise exception 'TEST: incorrect business hours';end if;
 if exists(select 1 from public.working_hours where stylist_id=stylist and (weekday not between 2 and 6 or opens_at<>'09:00'::time or closes_at<>case when weekday=6 then '15:00'::time else '19:00'::time end)) then raise exception 'TEST: incorrect Delia working hours';end if;
 if not exists(select 1 from public.salons where id=salon and timezone='America/Chicago') or not exists(select 1 from public.stylists st join public.locations l on l.id=st.location_id where st.id=stylist and l.timezone='America/Chicago') then raise exception 'TEST: incorrect timezone';end if;
 if exists(select 1 from public.time_blocks where stylist_id=stylist) then raise exception 'TEST: fresh migration added automatic time off';end if;
end $$;
-- Independent fixture with identical hours: exercise the real database booking engine.
do $$
declare salon uuid;stylist uuid;service uuid;variant uuid;ref uuid;ref2 uuid;hold uuid;block uuid;customer uuid;owner_id uuid;
 d date;weekday integer;slot_count integer;first_slot timestamptz;last_slot timestamptz;open_at timestamptz;close_at timestamptz;
 tuesday date; saturday date; spring date; autumn date; y integer; caught boolean; original jsonb;
begin
 insert into public.salons(name,timezone) values('Scheduling fixture','America/Chicago') returning id into salon;
 insert into public.locations(id,salon_id,name,timezone) values(salon,salon,'Scheduling fixture','America/Chicago');
 insert into public.stylists(location_id,name) values(salon,'Fixture Delia') returning id into stylist;
 insert into public.staff(salon_id,stylist_id,name) values(salon,stylist,'Fixture Delia');
 insert into public.booking_policies(salon_id,minimum_notice_minutes,maximum_advance_days) values(salon,0,365);
 insert into public.business_hours(salon_id,weekday,opens_at,closes_at) select salon,n,'09:00',case when n=6 then '15:00'::time else '19:00'::time end from generate_series(2,6) n;
 insert into public.working_hours(salon_id,stylist_id,weekday,opens_at,closes_at) select salon,stylist,n,'09:00',case when n=6 then '15:00'::time else '19:00'::time end from generate_series(2,6) n;
 insert into public.services(salon_id,slug,name,category,pricing_type,price_cents,duration_minutes,price_approved,duration_approved,status) values(salon,'schedule-test','Scheduling fixture service','EXTRAS','exact',1000,30,true,true,'published') returning id into service;
 -- A complete upcoming week proves closed days, continuous lunch, and exact closing boundaries.
 for d in select (current_date+n)::date from generate_series(7,13) n loop
  weekday=extract(dow from d);
  select count(*),min(starts_at),max(starts_at) into slot_count,first_slot,last_slot from public.available_slots(service,d);
  if weekday in (0,1) then
   if slot_count<>0 then raise exception 'TEST: Sunday/Monday must be closed';end if;
  else
   open_at=(d+'09:00'::time) at time zone 'America/Chicago';close_at=(d+case when weekday=6 then '15:00'::time else '19:00'::time end) at time zone 'America/Chicago';
   if slot_count<>case when weekday=6 then 12 else 20 end or first_slot<>open_at or last_slot<>close_at-interval '30 minutes' then raise exception 'TEST: hours or automatic gap mismatch for %',d;end if;
   if not exists(select 1 from public.available_slots(service,d) where starts_at=(d+'12:00'::time) at time zone 'America/Chicago') or not exists(select 1 from public.available_slots(service,d) where starts_at=(d+'12:30'::time) at time zone 'America/Chicago') then raise exception 'TEST: lunch was blocked';end if;
   if weekday=2 then tuesday=d;end if;if weekday=6 then saturday=d;end if;
  end if;
 end loop;
 -- America/Chicago UTC offsets change; local 9 AM opening and full day length do not.
 -- Select the next spring/autumn change so tests remain independent of the current date.
 for y in select extract(year from current_date)::integer+n from generate_series(0,1) n loop
  spring=make_date(y,3,1)+(7-extract(dow from make_date(y,3,1))::integer)%7+7;
  autumn=make_date(y,11,1)+(7-extract(dow from make_date(y,11,1))::integer)%7;
  for d in select v.day from (values(spring-1),(spring+2),(autumn-1),(autumn+2)) v(day) where v.day>current_date and v.day<current_date+365 loop
   select min(starts_at),count(*) into first_slot,slot_count from public.available_slots(service,d);
   if first_slot is distinct from ((d+'09:00'::time) at time zone 'America/Chicago') or slot_count<>case when extract(dow from d)=6 then 12 else 20 end then raise exception 'TEST: DST changed local operating hours';end if;
   if d in (spring-1,autumn+2) and (first_slot at time zone 'UTC')::time<>'15:00'::time then raise exception 'TEST: winter opening must be 15:00 UTC';end if;
   if d in (spring+2,autumn-1) and (first_slot at time zone 'UTC')::time<>'14:00'::time then raise exception 'TEST: summer opening must be 14:00 UTC';end if;
  end loop;
 end loop;
 -- Entire buffered appointment fits; a too-long service returns no slots.
 update public.services set duration_minutes=60,preparation_minutes=15,cleanup_minutes=15 where id=service;
 select min(starts_at),max(starts_at) into first_slot,last_slot from public.available_slots(service,tuesday);
 if first_slot<>(tuesday+'09:15'::time) at time zone 'America/Chicago' or last_slot<>(tuesday+'17:45'::time) at time zone 'America/Chicago' then raise exception 'TEST: preparation/cleanup exceeded business hours';end if;
 update public.services set duration_minutes=360 where id=service;
 if exists(select 1 from public.available_slots(service,saturday)) then raise exception 'TEST: Saturday accepted 6 hours plus buffers';end if;
 -- No invented break after an off-grid fifteen-minute appointment.
 update public.services set duration_minutes=15,preparation_minutes=0,cleanup_minutes=0 where id=service;
 open_at=(tuesday+'09:00'::time) at time zone 'America/Chicago';
 ref=public.reserve_appointment(service,stylist,open_at,'Fixture customer','first-'||gen_random_uuid()||'@example.invalid','5550000000');
 if not exists(select 1 from public.available_slots(service,tuesday) where starts_at=open_at+interval '15 minutes') then raise exception 'TEST: grid inserted an automatic 15-minute break';end if;
 ref2=public.reserve_appointment(service,stylist,open_at+interval '15 minutes','Fixture customer','second-'||gen_random_uuid()||'@example.invalid','5550000000');
 caught=false;begin perform public.reserve_appointment(service,stylist,open_at,'Fixture customer','conflict-'||gen_random_uuid()||'@example.invalid','5550000000');exception when others then caught=true;end;
 if not caught then raise exception 'TEST: duplicate booking accepted';end if;
 update public.appointments set status='cancelled' where id in (ref,ref2);
 -- Configured buffers remain real occupied time; adjacency adds exactly those buffers.
 update public.services set duration_minutes=30,preparation_minutes=5,cleanup_minutes=10 where id=service;
 ref=public.reserve_appointment(service,stylist,open_at+interval '5 minutes','Fixture customer','buffer-'||gen_random_uuid()||'@example.invalid','5550000000');
 if exists(select 1 from public.available_slots(service,tuesday) where starts_at<open_at+interval '50 minutes') or not exists(select 1 from public.available_slots(service,tuesday) where starts_at=open_at+interval '50 minutes') then raise exception 'TEST: buffered adjacency is incorrect';end if;
 update public.appointments set status='cancelled' where id=ref;
 update public.services set duration_minutes=15,preparation_minutes=0,cleanup_minutes=0 where id=service;
 -- Delia's manual block is honored; cancelling it immediately reopens lunchtime.
 insert into public.time_blocks(salon_id,stylist_id,starts_at,ends_at,note) values(salon,stylist,(tuesday+'12:00'::time) at time zone 'America/Chicago',(tuesday+'12:45'::time) at time zone 'America/Chicago','Owner-requested break') returning id into block;
 if exists(select 1 from public.available_slots(service,tuesday) where starts_at=(tuesday+'12:00'::time) at time zone 'America/Chicago') then raise exception 'TEST: manual block ignored';end if;
 if not exists(select 1 from public.available_slots(service,tuesday) where starts_at=(tuesday+'12:45'::time) at time zone 'America/Chicago') then raise exception 'TEST: extra break after manual block';end if;
 delete from public.time_blocks where id=block;
 if not exists(select 1 from public.available_slots(service,tuesday) where starts_at=(tuesday+'12:00'::time) at time zone 'America/Chicago') then raise exception 'TEST: removing manual block failed to reopen time';end if;
 -- An active hold excludes its occupied interval; a consumed hold becomes a booking.
 hold=public.create_appointment_hold(service,stylist,open_at);
 if exists(select 1 from public.available_slots(service,tuesday) where starts_at=open_at) then raise exception 'TEST: live hold ignored';end if;
 ref=public.reserve_appointment(service,stylist,open_at,'Fixture customer','hold-'||gen_random_uuid()||'@example.invalid','5550000000',null,hold);
 -- Changing recurring hours must never move or cancel the existing booking.
 select to_jsonb(a) into original from public.appointments a where id=ref;
 update public.business_hours h set opens_at='10:00',closes_at='17:00' where h.salon_id=salon and h.weekday=2;
 if (select to_jsonb(a) from public.appointments a where id=ref) is distinct from original then raise exception 'TEST: hours edit modified an appointment';end if;
 if exists(select 1 from public.available_slots(service,tuesday) where (starts_at at time zone 'America/Chicago')::time<'10:00') then raise exception 'TEST: edited business opening ignored';end if;
 -- Legacy all-day availability cannot open a closed Sunday or overrun Saturday.
 insert into public.availability(stylist_id,starts_at,ends_at) values(stylist,(saturday::timestamp at time zone 'America/Chicago'),((saturday+2)::timestamp at time zone 'America/Chicago'));
 if exists(select 1 from public.available_slots(service,saturday+1)) then raise exception 'TEST: dated availability reopened Sunday';end if;
 if exists(select 1 from public.available_slots(service,saturday) where starts_at+interval '15 minutes'>(saturday+'15:00'::time) at time zone 'America/Chicago') then raise exception 'TEST: dated availability exceeded Saturday closing';end if;
 -- A service variant uses its own duration/buffer, not its parent's duration.
 insert into public.service_variants(salon_id,service_id,slug,name,category,price_cents,duration_minutes,price_approved,duration_approved,status,cleanup_minutes) values(salon,service,'variant','Fixture long variant','EXTRAS',1000,60,true,true,'published',15) returning id into variant;
 select max(starts_at) into last_slot from public.available_slots(service,saturday,variant);
 if last_slot<>(saturday+'13:45'::time) at time zone 'America/Chicago' then raise exception 'TEST: variant cleanup must fit before 15:00';end if;
 -- Authenticated owner can edit recurring hours and add their own block through RLS.
 insert into auth.users(id,email) values(gen_random_uuid(),'schedule-owner@example.invalid') returning id into owner_id;
 insert into public.staff_roles(salon_id,user_id,role) values(salon,owner_id,'owner');
 perform set_config('test.schedule_owner',owner_id::text,true);perform set_config('test.schedule_salon',salon::text,true);perform set_config('test.schedule_stylist',stylist::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.schedule_owner'),true);
set local role authenticated;
do $$ begin
 update public.working_hours set closes_at='16:00' where salon_id=current_setting('test.schedule_salon')::uuid and weekday=3;
 if not found then raise exception 'TEST: owner cannot edit recurring hours';end if;
 insert into public.time_blocks(salon_id,stylist_id,starts_at,ends_at,note) values(current_setting('test.schedule_salon')::uuid,current_setting('test.schedule_stylist')::uuid,now()+interval '2 days',now()+interval '2 days 10 minutes','Owner manual block');
end $$;
reset role;
rollback;
select 'Confirmed week, continuous lunch, precise closing limits, service/variant buffers, back-to-back bookings, manual blocks, holds, conflicts, owner editing, preserved appointments and both Chicago DST transitions passed.' as result;

begin;
-- Entirely synthetic tenant, staff, owner, customer and calendar; always rolled back.
do $$ declare salon uuid;stylist uuid;owner_id uuid;outsider uuid;staff_user uuid;customer uuid;service uuid;begin
 insert into public.salons(name) values('Management workflow fixture') returning id into salon;
 insert into public.locations(id,salon_id,name) values(salon,salon,'Fixture location');
 insert into public.stylists(location_id,name) values(salon,'Fixture stylist') returning id into stylist;
 insert into public.staff(salon_id,stylist_id,name) values(salon,stylist,'Fixture stylist');
 insert into public.booking_policies(salon_id) values(salon);
 insert into public.salon_profiles(salon_id) values(salon);
 insert into auth.users(id,email) values(gen_random_uuid(),'fixture-owner@example.invalid') returning id into owner_id;
 insert into auth.users(id,email) values(gen_random_uuid(),'fixture-outsider@example.invalid') returning id into outsider;
 insert into auth.users(id,email) values(gen_random_uuid(),'fixture-staff@example.invalid') returning id into staff_user;
 insert into public.staff_roles(salon_id,user_id,role) values(salon,owner_id,'owner'),(salon,staff_user,'stylist');
 insert into public.customers(salon_id,name,email,phone) values(salon,'Fixture customer','workflow@example.invalid','') returning id into customer;
 insert into public.services(salon_id,slug,name,category,price_cents,duration_minutes,price_approved,duration_approved,status) values(salon,'fixture-service','Fixture service','EXTRAS',1000,30,true,true,'published') returning id into service;
 perform set_config('test.salon',salon::text,true);perform set_config('test.stylist',stylist::text,true);perform set_config('test.owner',owner_id::text,true);perform set_config('test.outsider',outsider::text,true);perform set_config('test.staff',staff_user::text,true);perform set_config('test.customer',customer::text,true);perform set_config('test.service',service::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
set local role authenticated;
do $$ declare salon uuid=current_setting('test.salon')::uuid;stylist uuid=current_setting('test.stylist')::uuid;service uuid=current_setting('test.service')::uuid;customer uuid=current_setting('test.customer')::uuid;a uuid;past uuid;start_at timestamptz=((current_date+7)::text||' 10:00')::timestamp at time zone 'America/Chicago';bad boolean;before_rev integer;begin
 if not public.is_salon_admin() then raise exception 'TEST owner denied';end if;
 insert into public.working_hours(salon_id,stylist_id,weekday,opens_at,closes_at) values(salon,stylist,extract(dow from start_at at time zone 'America/Chicago'),'09:00','17:00');
 insert into public.business_hours(salon_id,weekday,opens_at,closes_at) values(salon,extract(dow from start_at at time zone 'America/Chicago'),'09:00','17:00');
 a=public.admin_create_appointment(salon,customer,service,null,stylist,start_at,30,1200,'phone','Private fixture note',gen_random_uuid());
 if public.admin_create_appointment(salon,customer,service,null,stylist,start_at,30,1200,'phone','',a)<>a then raise exception 'TEST idempotency failed';end if;
 if not exists(select 1 from public.appointments where id=a and source='phone' and notes='Private fixture note' and price_cents=1200) then raise exception 'TEST manual appointment missing';end if;
 bad=false;begin perform public.admin_create_appointment(salon,customer,service,null,stylist,start_at,30,1200,'walk_in','',gen_random_uuid());exception when others then bad=true;end;if not bad then raise exception 'TEST double booking accepted';end if;
 bad=false;begin insert into public.time_blocks(salon_id,stylist_id,starts_at,ends_at) values(salon,stylist,start_at,start_at+interval '1 hour');exception when others then bad=true;end;if not bad then raise exception 'TEST time off overwrote appointment';end if;
 bad=false;begin insert into public.schedule_exceptions(salon_id,on_date) values(salon,(start_at at time zone 'America/Chicago')::date);exception when others then bad=true;end;if not bad then raise exception 'TEST closure overwrote appointment';end if;
 perform public.admin_update_appointment(a,1,start_at+interval '1 hour',45,1500,'confirmed','Rescheduled fixture');
 bad=false;begin perform public.admin_update_appointment(a,1,start_at,30,1200,'confirmed','stale');exception when others then bad=true;end;if not bad then raise exception 'TEST stale edit accepted';end if;
 bad=false;begin perform public.admin_update_appointment(a,2,start_at+interval '1 hour',45,1500,'completed','');exception when others then bad=true;end;if not bad then raise exception 'TEST future completion allowed';end if;
 perform public.admin_update_appointment(a,2,start_at+interval '1 hour',45,1500,'cancelled','Cancelled fixture');
 bad=false;begin perform public.admin_update_appointment(a,3,start_at+interval '1 hour',45,1500,'confirmed','');exception when others then bad=true;end;if not bad then raise exception 'TEST terminal status reopened';end if;
 insert into public.time_blocks(salon_id,stylist_id,starts_at,ends_at,note) values(salon,stylist,start_at,start_at+interval '1 hour','Fixture block');
 bad=false;begin perform public.admin_create_appointment(salon,customer,service,null,stylist,start_at,30,1200,'walk_in','',gen_random_uuid());exception when others then bad=true;end;if not bad then raise exception 'TEST booking ignored time off';end if;
 -- A genuine walk-in can have no email and still has a private customer/history record.
 insert into public.customers(salon_id,name,email,phone) values(salon,'Walk-in fixture',null,'') returning id into customer;
 past=public.admin_create_appointment(salon,customer,service,null,stylist,now()-interval '2 hours',30,1000,'walk_in','',gen_random_uuid());
 perform public.admin_update_appointment(past,1,(select starts_at from public.appointments where id=past),30,1000,'no_show','');
 past=public.admin_create_appointment(salon,customer,service,null,stylist,now()-interval '4 hours',30,2000,'walk_in','',gen_random_uuid());
 perform public.admin_update_appointment(past,1,(select starts_at from public.appointments where id=past),30,2000,'completed','');
 if not exists(select 1 from public.admin_report(salon,now()-interval '1 day',now()+interval '10 days') where status='completed' and estimated_cents=2000 and visits=1) then raise exception 'TEST report calculation failed';end if;
 update public.customers set notes='Sensitive note' where id=customer;
 if not exists(select 1 from public.audit_logs where entity_id=a and changes->'status'->>'after'='cancelled') then raise exception 'TEST status audit missing';end if;
 if exists(select 1 from public.audit_logs where changes::text like '%Sensitive note%') then raise exception 'TEST audit leaked private notes';end if;
 select revision into before_rev from public.salon_profiles where salon_id=salon;
 update public.salon_profiles set hero_title='Fixture updated homepage' where salon_id=salon and revision=before_rev;
 if not exists(select 1 from public.salon_profiles where salon_id=salon and revision=before_rev+1) then raise exception 'TEST profile revision missing';end if;
 update public.booking_policies set deposit_type='percent',deposit_value=20 where salon_id=salon;
 if exists(select 1 from public.booking_policies where salon_id=salon and payments_enabled) then raise exception 'TEST payments enabled';end if;
 update public.services set category='CUSTOM COLOR' where id=service;
 perform set_config('test.appointment',a::text,true);perform set_config('test.start',start_at::text,true);
end $$;
reset role;
-- Service-only availability picks up recurring hours and blocks, without materializing dated rows.
do $$ declare service uuid=current_setting('test.service')::uuid;stylist uuid=current_setting('test.stylist')::uuid;start_at timestamptz=current_setting('test.start')::timestamptz;begin
 if not exists(select 1 from public.available_slots(service,(start_at at time zone 'America/Chicago')::date) where starts_at=start_at+interval '2 hours') then raise exception 'TEST recurring hours absent from online slots';end if;
 if exists(select 1 from public.available_slots(service,(start_at at time zone 'America/Chicago')::date) where starts_at=start_at) then raise exception 'TEST online slots ignored time off';end if;
 if not exists(select 1 from public.notification_jobs where appointment_id=current_setting('test.appointment')::uuid and kind='cancellation' and state='pending' and (payload->>'starts_at')::timestamptz=start_at+interval '1 hour') then raise exception 'TEST cancellation message missing';end if;
 if exists(select 1 from public.notification_jobs where appointment_id=current_setting('test.appointment')::uuid and kind<>'cancellation' and state='pending') then raise exception 'TEST outdated reminders survived cancellation';end if;
end $$;
-- Authenticated outsiders and ordinary stylists must never read customer records.
select set_config('request.jwt.claim.sub',current_setting('test.outsider'),true);
set local role authenticated;
do $$ declare bad boolean;begin
 if exists(select 1 from public.customers) or exists(select 1 from public.appointments) or exists(select 1 from public.time_blocks) or exists(select 1 from public.audit_logs) then raise exception 'TEST outsider read private records';end if;
 bad=false;begin perform public.admin_create_appointment(current_setting('test.salon')::uuid,current_setting('test.customer')::uuid,current_setting('test.service')::uuid,null,current_setting('test.stylist')::uuid,now(),30,1000,'walk_in','',gen_random_uuid());exception when others then bad=true;end;if not bad then raise exception 'TEST outsider created appointment';end if;
 bad=false;begin perform public.admin_update_appointment(current_setting('test.appointment')::uuid,3,now(),30,1000,'cancelled','');exception when others then bad=true;end;if not bad then raise exception 'TEST outsider edited appointment';end if;
 bad=false;begin perform public.admin_report(current_setting('test.salon')::uuid,now(),now()+interval '1 day');exception when others then bad=true;end;if not bad then raise exception 'TEST outsider read report';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.staff'),true);
set local role authenticated;
do $$ begin if public.is_salon_admin() or exists(select 1 from public.customers) or exists(select 1 from public.appointments) then raise exception 'TEST stylist has administrator access';end if;end $$;
reset role;
set local role anon;
do $$ declare bad boolean;begin
 if not exists(select 1 from public.salon_profiles where salon_id=current_setting('test.salon')::uuid and hero_title='Fixture updated homepage') then raise exception 'TEST public content not published';end if;
 bad=false;begin perform id from public.customers;exception when insufficient_privilege then bad=true;end;if not bad then raise exception 'TEST anonymous customers exposed';end if;
 bad=false;begin update public.salon_profiles set hero_title='Attack';exception when insufficient_privilege then bad=true;end;if not bad then raise exception 'TEST anonymous write allowed';end if;
 bad=false;begin perform public.admin_report(current_setting('test.salon')::uuid,now(),now()+interval '1 day');exception when insufficient_privilege then bad=true;end;if not bad then raise exception 'TEST anonymous report accessible';end if;
end $$;
reset role;
rollback;
select 'Management authorization, manual booking, reschedule, cancellation, no-show, completion, recurring hours, time off, reports, notifications and audit passed; fixtures rolled back.' as result;

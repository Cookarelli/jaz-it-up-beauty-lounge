-- Forward-only expansion. Legacy location/stylist IDs and appointments are preserved.
create table public.salons(id uuid primary key default gen_random_uuid(),name text not null,timezone text not null default 'America/Chicago',created_at timestamptz not null default now());
insert into public.salons(id,name,timezone) select id,name,timezone from public.locations;
alter table public.locations add column salon_id uuid references public.salons;
update public.locations set salon_id=id;
alter table public.locations alter column salon_id set not null;
create index on public.locations(salon_id);
create table public.staff(id uuid primary key default gen_random_uuid(),salon_id uuid not null references public.salons,stylist_id uuid unique references public.stylists,name text not null,active boolean not null default true);
insert into public.staff(salon_id,stylist_id,name,active) select l.salon_id,s.id,s.name,s.active from public.stylists s join public.locations l on l.id=s.location_id;
create index on public.staff(salon_id);
create table public.staff_roles(id uuid primary key default gen_random_uuid(),salon_id uuid not null references public.salons,user_id uuid not null references auth.users on delete cascade,staff_id uuid references public.staff,role text not null check(role in ('owner','manager','stylist')),unique(salon_id,user_id));
insert into public.staff_roles(salon_id,user_id,role) select s.id,a.user_id,'owner' from public.salons s cross join public.salon_admins a;
create index on public.staff_roles(user_id,salon_id);
create function public.can_manage_salon(p_salon uuid) returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.staff_roles where salon_id=p_salon and user_id=(select auth.uid()) and role in ('owner','manager')) $$;
create or replace function public.is_salon_admin() returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.staff_roles where user_id=(select auth.uid()) and role in ('owner','manager')) $$;
alter table public.services add column salon_id uuid references public.salons;
update public.services set salon_id=(select id from public.salons order by created_at limit 1);
alter table public.services alter column salon_id set not null;
alter table public.services alter column duration_minutes drop not null;
alter table public.services drop constraint services_duration_minutes_check;
alter table public.services add check(duration_minutes between 1 and 480);
alter table public.services alter column price_cents drop not null;
alter table public.services add column slug text;
update public.services set slug=id::text;
alter table public.services alter column slug set not null;
alter table public.services add constraint services_salon_slug unique(salon_id,slug);
alter table public.services add column pricing_type text not null default 'exact' check(pricing_type in ('exact','starting','range','consultation'));
alter table public.services add column price_max_cents integer;
alter table public.services add column duration_min_minutes integer;
alter table public.services add column duration_max_minutes integer;
alter table public.services add column price_approved boolean not null default false;
alter table public.services add column duration_approved boolean not null default false;
alter table public.services add column status text not null default 'draft' check(status in ('draft','published','archived'));
alter table public.services add column length_qualification text not null default 'any';
alter table public.services add column display_order integer not null default 0 check(display_order>=0);
alter table public.services add column preparation_minutes integer not null default 0 check(preparation_minutes between 0 and 120);
alter table public.services add column cleanup_minutes integer not null default 0 check(cleanup_minutes between 0 and 120);
alter table public.services add column admin_notes text not null default '';
alter table public.services add column includes_cut_style boolean not null default false;
alter table public.services add column revision integer not null default 1;
alter table public.services add constraint service_price_rules check((pricing_type='consultation' and price_cents is null and price_max_cents is null and not price_approved) or (pricing_type in ('exact','starting') and price_cents>=0 and price_cents is not null and price_max_cents is null) or (pricing_type='range' and price_cents is not null and price_max_cents is not null and price_max_cents>=price_cents and price_cents>=0));
alter table public.services add constraint service_duration_approval check(not duration_approved or duration_minutes is not null);
alter table public.services add constraint service_duration_range check((duration_min_minutes is null or duration_min_minutes between 1 and 480) and (duration_max_minutes is null or duration_max_minutes between 1 and 480) and (duration_min_minutes is null or duration_max_minutes is null or duration_max_minutes>=duration_min_minutes));
-- New catalog entries may have null exact price/duration pending owner review.
create table public.service_variants (like public.services including defaults including constraints);
alter table public.service_variants add primary key(id);
alter table public.service_variants add column service_id uuid not null references public.services;
alter table public.service_variants add foreign key(salon_id) references public.salons;
alter table public.service_variants add unique(service_id,slug);
create index on public.services(salon_id,status,display_order);
create index on public.service_variants(service_id,status,display_order);
create table public.business_hours(id uuid primary key default gen_random_uuid(),salon_id uuid not null references public.salons,weekday integer not null check(weekday between 0 and 6),opens_at time not null,closes_at time not null,check(closes_at>opens_at),unique(salon_id,weekday));
create table public.schedule_exceptions(id uuid primary key default gen_random_uuid(),salon_id uuid not null references public.salons,stylist_id uuid references public.stylists,on_date date not null,closed boolean not null default true,opens_at time,closes_at time,note text not null default '',check((closed and opens_at is null and closes_at is null) or (not closed and opens_at is not null and closes_at>opens_at)));
create index on public.schedule_exceptions(salon_id,on_date);
create table public.booking_policies(salon_id uuid primary key references public.salons,minimum_notice_minutes integer not null default 120 check(minimum_notice_minutes>=0),maximum_advance_days integer not null default 90 check(maximum_advance_days between 1 and 365),slot_interval_minutes integer not null default 30 check(slot_interval_minutes between 5 and 120),hold_minutes integer not null default 5 check(hold_minutes between 1 and 15),cancellation_notice_hours integer check(cancellation_notice_hours>=0),cancellation_text text not null default '',payments_enabled boolean not null default false check(payments_enabled=false),deposit_type text not null default 'none' check(deposit_type in ('none','fixed','percent')),deposit_value integer check(deposit_value>=0),check((deposit_type='none' and deposit_value is null) or (deposit_type='fixed' and deposit_value is not null) or (deposit_type='percent' and deposit_value between 1 and 100)));
insert into public.booking_policies(salon_id) select id from public.salons;
create table public.customers(id uuid primary key default gen_random_uuid(),salon_id uuid not null references public.salons,name text not null,email text not null,phone text not null,created_at timestamptz not null default now(),unique(salon_id,email));
alter table public.appointments add column customer_id uuid references public.customers;
alter table public.appointments add column variant_id uuid references public.service_variants;
alter table public.appointments add column preparation_minutes integer not null default 0 check(preparation_minutes>=0);
alter table public.appointments add column cleanup_minutes integer not null default 0 check(cleanup_minutes>=0);
alter table public.appointments add column pricing_type text not null default 'exact';
alter table public.appointments add column service_snapshot jsonb not null default '{}';
create index on public.appointments(customer_id);
create index on public.appointments(variant_id);
create table public.appointment_holds(id uuid primary key default gen_random_uuid(),service_id uuid not null references public.services,variant_id uuid references public.service_variants,stylist_id uuid not null references public.stylists,starts_at timestamptz not null,ends_at timestamptz not null,expires_at timestamptz not null,consumed_at timestamptz,check(ends_at>starts_at));
create index on public.appointment_holds(stylist_id,starts_at,expires_at);
create index on public.appointment_holds(service_id);
create index on public.appointment_holds(variant_id);
create table public.notification_events(id uuid primary key default gen_random_uuid(),job_id uuid not null references public.notification_jobs,event_type text not null check(event_type in ('attempted','delivered','failed')),created_at timestamptz not null default now(),provider_reference text);
create index on public.notification_events(job_id);
create table public.audit_logs(id uuid primary key default gen_random_uuid(),salon_id uuid not null references public.salons,actor_id uuid,entity_type text not null,entity_id uuid not null,action text not null,revision integer,created_at timestamptz not null default now());
create index on public.audit_logs(salon_id,created_at);
create schema if not exists salon_private;
revoke all on schema salon_private from public,anon,authenticated;
-- Only installed triggers can append audit records. No client INSERT or payload with customer data.
create function salon_private.audit_catalog() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.audit_logs(salon_id,actor_id,entity_type,entity_id,action,revision) values(new.salon_id,auth.uid(),tg_table_name,new.id,tg_op,new.revision); return new; end $$;
revoke execute on function salon_private.audit_catalog() from public,anon,authenticated;
create function public.validate_catalog_update() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if tg_op='UPDATE' then
 if new.salon_id<>old.salon_id or new.id<>old.id or new.slug<>old.slug then raise exception 'Catalog identity cannot be changed'; end if;
 if tg_table_name='service_variants' and new.service_id<>old.service_id then raise exception 'Variant parent cannot be changed'; end if;
 new.revision=old.revision+1;
 end if;
 if tg_table_name='service_variants' and not exists(select 1 from public.services where id=new.service_id and salon_id=new.salon_id and category=new.category and includes_cut_style=new.includes_cut_style) then raise exception 'Variant must belong to matching salon, category and chemical bundle'; end if;
 return new; end $$;
create trigger validate_services before insert or update on public.services for each row execute function public.validate_catalog_update();
create trigger validate_variants before insert or update on public.service_variants for each row execute function public.validate_catalog_update();
create trigger audit_services after insert or update on public.services for each row execute function salon_private.audit_catalog();
create trigger audit_variants after insert or update on public.service_variants for each row execute function salon_private.audit_catalog();
-- No public table writes. Anonymous readers receive explicit catalog columns, never admin notes.
do $$ declare t text; begin foreach t in array array['salons','staff','staff_roles','service_variants','business_hours','schedule_exceptions','booking_policies','customers','appointment_holds','notification_events','audit_logs'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon,authenticated',t); execute format('grant all on public.%I to service_role',t); end loop; end $$;
create policy own_role on public.staff_roles for select to authenticated using(user_id=(select auth.uid()));
grant select on public.staff_roles to authenticated;
create policy manage_salons on public.salons for select to authenticated using(public.can_manage_salon(id));
grant select on public.salons to authenticated;
create policy manage_staff on public.staff for all to authenticated using(public.can_manage_salon(salon_id)) with check(public.can_manage_salon(salon_id));
create policy manage_variants on public.service_variants for all to authenticated using(public.can_manage_salon(salon_id)) with check(public.can_manage_salon(salon_id));
create policy public_variants on public.service_variants for select to anon using(status='published' and active and exists(select 1 from public.services s where s.id=service_id and s.status='published' and s.active));
drop policy published_services on public.services;
drop policy manage_services on public.services;
create policy published_services on public.services for select to anon using(status='published' and active);
create policy manage_services on public.services for all to authenticated using(public.can_manage_salon(salon_id)) with check(public.can_manage_salon(salon_id));
revoke all on public.services from anon,authenticated;
grant select,insert,update on public.services,public.service_variants to authenticated;
grant select,insert,update,delete on public.staff,public.business_hours,public.schedule_exceptions to authenticated;
grant select,update on public.booking_policies to authenticated;
grant select,insert,update on public.customers to authenticated;
grant select on public.audit_logs to authenticated;
create policy manage_hours_config on public.business_hours for all to authenticated using(public.can_manage_salon(salon_id)) with check(public.can_manage_salon(salon_id));
create policy manage_exceptions on public.schedule_exceptions for all to authenticated using(public.can_manage_salon(salon_id)) with check(public.can_manage_salon(salon_id));
create policy manage_policies on public.booking_policies for all to authenticated using(public.can_manage_salon(salon_id)) with check(public.can_manage_salon(salon_id));
create policy manage_customers on public.customers for all to authenticated using(public.can_manage_salon(salon_id)) with check(public.can_manage_salon(salon_id));
create policy read_audit on public.audit_logs for select to authenticated using(public.can_manage_salon(salon_id));
grant select(id,salon_id,slug,name,description,category,duration_minutes,duration_min_minutes,duration_max_minutes,price_cents,price_max_cents,pricing_type,price_approved,duration_approved,status,active,length_qualification,display_order,preparation_minutes,cleanup_minutes,includes_cut_style,revision) on public.services to anon;
grant select(id,service_id,salon_id,slug,name,description,category,duration_minutes,duration_min_minutes,duration_max_minutes,price_cents,price_max_cents,pricing_type,price_approved,duration_approved,status,active,length_qualification,display_order,preparation_minutes,cleanup_minutes,includes_cut_style,revision) on public.service_variants to anon;
-- Existing management policies now scope through their preserved location/stylist IDs.
drop policy manage_locations on public.locations;
create policy manage_locations on public.locations for all to authenticated using(public.can_manage_salon(salon_id)) with check(public.can_manage_salon(salon_id));
drop policy manage_stylists on public.stylists;
create policy manage_stylists on public.stylists for all to authenticated using(exists(select 1 from public.locations l where l.id=location_id and public.can_manage_salon(l.salon_id))) with check(exists(select 1 from public.locations l where l.id=location_id and public.can_manage_salon(l.salon_id)));
drop policy manage_hours on public.availability;
create policy manage_hours on public.availability for all to authenticated using(exists(select 1 from public.stylists st join public.locations l on l.id=st.location_id where st.id=stylist_id and public.can_manage_salon(l.salon_id))) with check(exists(select 1 from public.stylists st join public.locations l on l.id=st.location_id where st.id=stylist_id and public.can_manage_salon(l.salon_id)));
drop policy manage_appointments on public.appointments;
create policy manage_appointments on public.appointments for all to authenticated using(exists(select 1 from public.stylists st join public.locations l on l.id=st.location_id where st.id=stylist_id and public.can_manage_salon(l.salon_id))) with check(exists(select 1 from public.stylists st join public.locations l on l.id=st.location_id join public.services s on s.salon_id=l.salon_id where st.id=stylist_id and s.id=service_id and public.can_manage_salon(l.salon_id)));
-- Server-only RPCs share a per-stylist transaction lock. A hold cannot race a reservation.
drop function public.reserve_appointment(uuid,uuid,timestamptz,text,text,text);
drop function public.available_slots(uuid,date);
create function public.booking_item(p_service uuid,p_variant uuid default null) returns setof public.services language sql stable security invoker set search_path='' as $$
 select s.* from public.services s where s.id=p_service and p_variant is null and not exists(select 1 from public.service_variants v where v.service_id=s.id and v.active and v.status='published')
 union all select v.id,v.name,v.description,v.category,v.duration_minutes,v.price_cents,v.active,v.salon_id,v.slug,v.pricing_type,v.price_max_cents,v.duration_min_minutes,v.duration_max_minutes,v.price_approved,v.duration_approved,v.status,v.length_qualification,v.display_order,v.preparation_minutes,v.cleanup_minutes,v.admin_notes,v.includes_cut_style,v.revision from public.service_variants v join public.services s on s.id=v.service_id where v.id=p_variant and s.id=p_service and s.active and s.status='published'
$$;
create function public.available_slots(p_service uuid,p_date date,p_variant uuid default null,p_hold uuid default null) returns table(starts_at timestamptz,stylist_id uuid) language sql stable security invoker set search_path='' as $$
 select t,a.stylist_id from public.booking_item(p_service,p_variant) s join public.booking_policies p on p.salon_id=s.salon_id join public.locations l on l.salon_id=s.salon_id join public.stylists st on st.location_id=l.id and st.active join public.staff staff on staff.stylist_id=st.id and staff.active join public.availability a on a.stylist_id=st.id cross join lateral generate_series(a.starts_at+make_interval(mins=>s.preparation_minutes),a.ends_at-make_interval(mins=>s.duration_minutes+s.cleanup_minutes),make_interval(mins=>p.slot_interval_minutes)) t
 where s.active and s.status='published' and s.price_approved and s.duration_approved and s.duration_minutes is not null and s.price_cents is not null and s.pricing_type in ('exact','starting')
 and (t at time zone l.timezone)::date=p_date and t>=now()+make_interval(mins=>p.minimum_notice_minutes) and t<=now()+make_interval(days=>p.maximum_advance_days)
 and (not exists(select 1 from public.business_hours h where h.salon_id=s.salon_id) or exists(select 1 from public.business_hours h where h.salon_id=s.salon_id and h.weekday=extract(dow from t at time zone l.timezone) and ((t-make_interval(mins=>s.preparation_minutes)) at time zone l.timezone)::time>=h.opens_at and ((t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes)) at time zone l.timezone)::date=p_date and ((t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes)) at time zone l.timezone)::time<=h.closes_at))
 and not exists(select 1 from public.schedule_exceptions e where e.salon_id=s.salon_id and (e.stylist_id is null or e.stylist_id=st.id) and e.on_date=p_date and (e.closed or ((t-make_interval(mins=>s.preparation_minutes)) at time zone l.timezone)::time<e.opens_at or ((t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes)) at time zone l.timezone)::time>e.closes_at))
 and not exists(select 1 from public.appointments b where b.stylist_id=a.stylist_id and b.status<>'cancelled' and tstzrange(b.starts_at-make_interval(mins=>b.preparation_minutes),b.ends_at+make_interval(mins=>b.cleanup_minutes),'[)') && tstzrange(t-make_interval(mins=>s.preparation_minutes),t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes),'[)'))
 and not exists(select 1 from public.appointment_holds h where h.stylist_id=a.stylist_id and h.consumed_at is null and h.expires_at>now() and (p_hold is null or h.id<>p_hold) and tstzrange(h.starts_at,h.ends_at,'[)') && tstzrange(t-make_interval(mins=>s.preparation_minutes),t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes),'[)')) order by t;
$$;
create function public.create_appointment_hold(p_service uuid,p_stylist uuid,p_start timestamptz,p_variant uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$ declare item public.services; token uuid; tz text; begin
 perform pg_advisory_xact_lock(hashtextextended(p_stylist::text,1));
 select * into strict item from public.booking_item(p_service,p_variant);
 select timezone into tz from public.salons where id=item.salon_id;
 if not exists(select 1 from public.available_slots(p_service,(p_start at time zone tz)::date,p_variant) where starts_at=p_start and stylist_id=p_stylist) then raise exception 'Unavailable'; end if;
 insert into public.appointment_holds(service_id,variant_id,stylist_id,starts_at,ends_at,expires_at) select p_service,p_variant,p_stylist,p_start-make_interval(mins=>item.preparation_minutes),p_start+make_interval(mins=>item.duration_minutes+item.cleanup_minutes),now()+make_interval(mins=>hold_minutes) from public.booking_policies where salon_id=item.salon_id returning id into token;
 return token; end $$;
create function public.reserve_appointment(p_service uuid,p_stylist uuid,p_start timestamptz,p_name text,p_email text,p_phone text,p_variant uuid default null,p_hold uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
 declare item public.services; ref uuid; customer uuid; tz text; payload jsonb;
 begin
 perform pg_advisory_xact_lock(hashtextextended(lower(p_email),0));
 perform pg_advisory_xact_lock(hashtextextended(p_stylist::text,1));
 perform 1 from public.services where id=p_service for share;
 perform 1 from public.service_variants where id=p_variant for share;
 select * into strict item from public.booking_item(p_service,p_variant);
 select timezone into tz from public.salons where id=item.salon_id;
 if length(trim(p_name)) not between 2 and 100 or length(p_email)>254 or p_email not like '%@%' or length(p_phone) not between 7 and 30 then raise exception 'Invalid customer'; end if;
 if exists(select 1 from public.appointments where lower(email)=lower(p_email) and created_at>now()-interval '5 minutes') then raise exception 'Booking cooldown'; end if;
 if p_hold is not null and not exists(select 1 from public.appointment_holds where id=p_hold and service_id=p_service and variant_id is not distinct from p_variant and stylist_id=p_stylist and starts_at=p_start-make_interval(mins=>item.preparation_minutes) and expires_at>now() and consumed_at is null) then raise exception 'Invalid hold'; end if;
 perform 1 from public.services where id=p_service for share;
 perform 1 from public.service_variants where id=p_variant for share;
 perform 1 from public.availability where stylist_id=p_stylist and starts_at<=p_start and ends_at>=p_start+make_interval(mins=>item.duration_minutes+item.cleanup_minutes) for share;
 if not exists(select 1 from public.available_slots(p_service,(p_start at time zone tz)::date,p_variant,p_hold) where starts_at=p_start and stylist_id=p_stylist) then raise exception 'Unavailable or requires owner review'; end if;
 insert into public.customers(salon_id,name,email,phone) values(item.salon_id,trim(p_name),lower(trim(p_email)),p_phone) on conflict(salon_id,email) do update set name=excluded.name,phone=excluded.phone returning id into customer;
 insert into public.appointments(service_id,variant_id,stylist_id,starts_at,ends_at,client_name,email,phone,price_cents,customer_id,preparation_minutes,cleanup_minutes,pricing_type,service_snapshot) values(p_service,p_variant,p_stylist,p_start,p_start+make_interval(mins=>item.duration_minutes),trim(p_name),lower(p_email),p_phone,item.price_cents,customer,item.preparation_minutes,item.cleanup_minutes,item.pricing_type,jsonb_build_object('name',item.name,'includes_cut_style',item.includes_cut_style,'duration_minutes',item.duration_minutes,'price_cents',item.price_cents,'pricing_type',item.pricing_type,'length_qualification',item.length_qualification)) returning id into ref;
 update public.appointment_holds set consumed_at=now() where id=p_hold;
 payload=jsonb_build_object('email',p_email,'name',p_name,'starts_at',p_start,'reference',ref);
 insert into public.notification_jobs(appointment_id,kind,payload,due_at) values(ref,'confirmation',payload,now()),(ref,'reminder',payload,greatest(now(),p_start-interval '24 hours'));
 return ref; end $$;
revoke execute on function public.booking_item(uuid,uuid),public.available_slots(uuid,date,uuid,uuid),public.reserve_appointment(uuid,uuid,timestamptz,text,text,text,uuid,uuid),public.create_appointment_hold(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.booking_item(uuid,uuid),public.available_slots(uuid,date,uuid,uuid),public.reserve_appointment(uuid,uuid,timestamptz,text,text,text,uuid,uuid),public.create_appointment_hold(uuid,uuid,timestamptz,uuid) to service_role;
-- Atomic, optimistic admin update. Identity, tenancy, parent and bundle flags are immutable here.
create function public.edit_catalog_entry(p_kind text,p_id uuid,p_revision integer,p_values jsonb) returns integer language plpgsql security invoker set search_path='' as $$ declare v_count integer; begin
 if not (select auth.uid() is not null) then raise exception 'Sign in required'; end if;
 if p_kind not in ('service','variant') then raise exception 'Invalid entry type'; end if;
 if p_values - array['name','description','pricing_type','price_cents','price_max_cents','duration_minutes','duration_min_minutes','duration_max_minutes','price_approved','duration_approved','status','length_qualification','display_order','preparation_minutes','cleanup_minutes','admin_notes'] <> '{}'::jsonb then raise exception 'Unexpected fields'; end if;
 if p_kind='service' then
 update public.services set name=p_values->>'name',description=p_values->>'description',pricing_type=p_values->>'pricing_type',price_cents=(p_values->>'price_cents')::integer,price_max_cents=(p_values->>'price_max_cents')::integer,duration_minutes=(p_values->>'duration_minutes')::integer,duration_min_minutes=(p_values->>'duration_min_minutes')::integer,duration_max_minutes=(p_values->>'duration_max_minutes')::integer,price_approved=(p_values->>'price_approved')::boolean,duration_approved=(p_values->>'duration_approved')::boolean,status=p_values->>'status',length_qualification=p_values->>'length_qualification',display_order=(p_values->>'display_order')::integer,preparation_minutes=(p_values->>'preparation_minutes')::integer,cleanup_minutes=(p_values->>'cleanup_minutes')::integer,admin_notes=p_values->>'admin_notes' where id=p_id and revision=p_revision;
 else
 update public.service_variants set name=p_values->>'name',description=p_values->>'description',pricing_type=p_values->>'pricing_type',price_cents=(p_values->>'price_cents')::integer,price_max_cents=(p_values->>'price_max_cents')::integer,duration_minutes=(p_values->>'duration_minutes')::integer,duration_min_minutes=(p_values->>'duration_min_minutes')::integer,duration_max_minutes=(p_values->>'duration_max_minutes')::integer,price_approved=(p_values->>'price_approved')::boolean,duration_approved=(p_values->>'duration_approved')::boolean,status=p_values->>'status',length_qualification=p_values->>'length_qualification',display_order=(p_values->>'display_order')::integer,preparation_minutes=(p_values->>'preparation_minutes')::integer,cleanup_minutes=(p_values->>'cleanup_minutes')::integer,admin_notes=p_values->>'admin_notes' where id=p_id and revision=p_revision;
 end if;
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'This entry changed or access was denied. Reload before editing.'; end if;
 return p_revision+1; end $$;
revoke execute on function public.edit_catalog_entry(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.edit_catalog_entry(text,uuid,integer,jsonb) to authenticated;

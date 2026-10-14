-- Forward-only owner dashboard. Existing appointments and service IDs are preserved.
alter table public.customers alter column email drop not null;
alter table public.customers add column notes text not null default '' check(length(notes)<=2000);
alter table public.customers add column revision integer not null default 1;
alter table public.customers add constraint customer_text_bounds check(length(trim(name)) between 2 and 100 and (email is null or (length(email)<=254 and email like '%@%')) and length(phone)<=30);
alter table public.appointments alter column email drop not null;
alter table public.appointments add column notes text not null default '' check(length(notes)<=2000);
alter table public.appointments add column source text not null default 'online' check(source in ('online','phone','walk_in'));
alter table public.appointments add column revision integer not null default 1;
alter table public.appointments drop constraint appointments_status_check;
alter table public.appointments add constraint appointments_status_check check(status in ('confirmed','cancelled','completed','no_show'));
alter table public.appointments add constraint appointment_values check(price_cents between 0 and 1000000 and ends_at<=starts_at+interval '8 hours' and preparation_minutes<=120 and cleanup_minutes<=120 and length(client_name) between 2 and 100 and length(phone)<=30);
revoke delete on public.appointments from authenticated;
create index appointments_start_status on public.appointments(starts_at,status);
create index customers_salon_name on public.customers(salon_id,lower(name));
alter table public.audit_logs add column changes jsonb not null default '{}';
create table public.salon_profiles(
 salon_id uuid primary key references public.salons,
 phone text not null default '' check(length(phone)<=30), email text not null default '' check(email='' or (email like '%@%' and length(email)<=254)),
 address text not null default '' check(length(address)<=500),
 instagram_url text not null default '' check(instagram_url='' or instagram_url ~ '^https://[^[:space:]]+$'),
 facebook_url text not null default '' check(facebook_url='' or facebook_url ~ '^https://[^[:space:]]+$'),
 hero_title text not null default 'A little refresh. A whole new feeling.' check(length(hero_title) between 2 and 160),
 hero_text text not null default 'Beautiful hair. Easy conversation. Time just for you. Make yourself at home at Jaz It Up Beauty Lounge.' check(length(hero_text)<=1000),
 about_text text not null default 'Welcome to Delia’s Jaz It Up Beauty Lounge. A warm space for fresh looks, personal attention, and a well-deserved moment to yourself.' check(length(about_text)<=2000),
 revision integer not null default 1
);
insert into public.salon_profiles(salon_id) select id from public.salons;
create table public.working_hours(id uuid primary key default gen_random_uuid(),salon_id uuid not null references public.salons,stylist_id uuid not null references public.stylists,weekday integer not null check(weekday between 0 and 6),opens_at time not null,closes_at time not null,check(closes_at>opens_at),unique(stylist_id,weekday));
create index working_hours_salon on public.working_hours(salon_id);
create table public.time_blocks(id uuid primary key default gen_random_uuid(),salon_id uuid not null references public.salons,stylist_id uuid not null references public.stylists,starts_at timestamptz not null,ends_at timestamptz not null,note text not null default '' check(length(note)<=500),check(ends_at>starts_at),check(ends_at<=starts_at+interval '366 days'));
create index time_blocks_stylist_start on public.time_blocks(stylist_id,starts_at);
create index time_blocks_salon on public.time_blocks(salon_id);
do $$ declare t text;begin foreach t in array array['salon_profiles','working_hours','time_blocks'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy manager_access on public.%I for all to authenticated using(public.can_manage_salon(salon_id)) with check(public.can_manage_salon(salon_id))',t);
end loop;end $$;
revoke insert,delete on public.salon_profiles from authenticated;
create policy public_profile on public.salon_profiles for select to anon using(true);
grant select on public.salon_profiles to anon;
create policy public_business_hours on public.business_hours for select to anon using(true);
grant select on public.business_hours to anon;
-- Customer contacts never become public; only explicit public profile and hours tables do.
create function public.dashboard_revision() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.salon_id<>old.salon_id then raise exception 'Salon identity cannot change';end if;
 new.revision=old.revision+1;return new;end $$;
create trigger customer_revision before update on public.customers for each row execute function public.dashboard_revision();
create trigger profile_revision before update on public.salon_profiles for each row execute function public.dashboard_revision();
-- Audit changed field names plus non-contact scheduling values. No copied customer notes/contact data.
create or replace function salon_private.audit_operations() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; prev jsonb; salon uuid; entity uuid; delta jsonb;begin
 r=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;prev=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 entity=coalesce((r->>'id')::uuid,(r->>'salon_id')::uuid);
 if tg_table_name='appointments' then select salon_id into salon from public.services where id=(r->>'service_id')::uuid;
 elsif tg_table_name='availability' then select l.salon_id into salon from public.stylists st join public.locations l on l.id=st.location_id where st.id=(r->>'stylist_id')::uuid;
 else salon=(r->>'salon_id')::uuid;end if;
 select coalesce(jsonb_object_agg(k,jsonb_build_object('before',prev->k,'after',case when tg_op='DELETE' then null else r->k end)),'{}') into delta from jsonb_object_keys(r) k where k in ('status','starts_at','ends_at','price_cents','weekday','opens_at','closes_at','closed','on_date','deposit_type','deposit_value','cancellation_notice_hours') and (prev->k is distinct from r->k or tg_op='DELETE');
 delta=delta||jsonb_build_object('fields',coalesce((select jsonb_agg(k) from jsonb_object_keys(r) k where prev->k is distinct from r->k),'[]'));
 insert into public.audit_logs(salon_id,actor_id,entity_type,entity_id,action,revision,changes) values(salon,auth.uid(),tg_table_name,entity,tg_op,(r->>'revision')::integer,delta);return null;end $$;
create trigger audit_customers after insert or update on public.customers for each row execute function salon_private.audit_operations();
create trigger audit_profile after update on public.salon_profiles for each row execute function salon_private.audit_operations();
create trigger audit_working_hours after insert or update or delete on public.working_hours for each row execute function salon_private.audit_operations();
create trigger audit_time_blocks after insert or update or delete on public.time_blocks for each row execute function salon_private.audit_operations();
-- Schedule changes take the same per-stylist lock as public holds and reservations.
create function salon_private.guard_schedule_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; st uuid; salon uuid; tz text; first_at timestamptz; last_at timestamptz;begin
 r=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;salon=(r->>'salon_id')::uuid;
 if auth.uid() is not null and not public.can_manage_salon(salon) then raise exception 'Access denied';end if;
 if tg_op='UPDATE' and ((to_jsonb(old)->>'salon_id') is distinct from r->>'salon_id' or (to_jsonb(old)->>'stylist_id') is distinct from r->>'stylist_id') then raise exception 'Schedule identity cannot change';end if;
 if r->>'stylist_id' is not null and not exists(select 1 from public.stylists s join public.locations l on l.id=s.location_id where s.id=(r->>'stylist_id')::uuid and l.salon_id=salon) then raise exception 'Stylist does not belong to salon';end if;
 select timezone into tz from public.salons where id=salon;
 for st in select s.id from public.stylists s join public.locations l on l.id=s.location_id where l.salon_id=salon and (r->>'stylist_id' is null or s.id=(r->>'stylist_id')::uuid) order by s.id loop
 perform pg_advisory_xact_lock(hashtextextended(st::text,1));
 if tg_op<>'DELETE' and tg_table_name in ('time_blocks','schedule_exceptions') then
 if tg_table_name='time_blocks' then first_at=(r->>'starts_at')::timestamptz;last_at=(r->>'ends_at')::timestamptz;
 else first_at=(r->>'on_date')::date::timestamp at time zone tz;last_at=((r->>'on_date')::date+1)::timestamp at time zone tz;end if;
 if exists(select 1 from public.appointments a where a.stylist_id=st and a.status='confirmed' and tstzrange(a.starts_at-make_interval(mins=>a.preparation_minutes),a.ends_at+make_interval(mins=>a.cleanup_minutes),'[)') && tstzrange(first_at,last_at,'[)') and (tg_table_name='time_blocks' or (r->>'closed')::boolean or ((a.starts_at-make_interval(mins=>a.preparation_minutes)) at time zone tz)::time<(r->>'opens_at')::time or ((a.ends_at+make_interval(mins=>a.cleanup_minutes)) at time zone tz)::time>(r->>'closes_at')::time)) then raise exception 'Existing appointments conflict. Reschedule or cancel them first.';end if;
 if exists(select 1 from public.appointment_holds h where h.stylist_id=st and h.expires_at>now() and h.consumed_at is null and tstzrange(h.starts_at,h.ends_at,'[)') && tstzrange(first_at,last_at,'[)')) then raise exception 'A booking hold is active. Try again after it expires.';end if;
 end if;end loop;return case when tg_op='DELETE' then old else new end;end $$;
revoke execute on function salon_private.guard_schedule_change() from public,anon,authenticated;
create trigger guard_working_hours before insert or update or delete on public.working_hours for each row execute function salon_private.guard_schedule_change();
create trigger guard_time_blocks before insert or update or delete on public.time_blocks for each row execute function salon_private.guard_schedule_change();
create trigger guard_business_hours before insert or update or delete on public.business_hours for each row execute function salon_private.guard_schedule_change();
create trigger guard_exceptions before insert or update or delete on public.schedule_exceptions for each row execute function salon_private.guard_schedule_change();
-- Internal trigger may read server-only holds but cannot be called through the API.
create function salon_private.guard_appointment() returns trigger language plpgsql security definer set search_path='' as $$
declare salon uuid; tz text;begin
 select s.salon_id,l.timezone into salon,tz from public.services s join public.locations l on l.salon_id=s.salon_id join public.stylists st on st.location_id=l.id where s.id=new.service_id and st.id=new.stylist_id;
 if salon is null or (auth.uid() is not null and not public.can_manage_salon(salon)) then raise exception 'Access denied';end if;
 if tg_op='UPDATE' then
 if new.service_id<>old.service_id or new.variant_id is distinct from old.variant_id or new.stylist_id<>old.stylist_id or new.customer_id is distinct from old.customer_id or new.source<>old.source then raise exception 'Appointment identity cannot change';end if;
 if old.status<>'confirmed' and (new.status<>old.status or new.starts_at<>old.starts_at or new.ends_at<>old.ends_at or new.price_cents<>old.price_cents) then raise exception 'Closed appointments cannot be rescheduled or reopened';end if;
 new.revision=old.revision+1;
 end if;
 if new.variant_id is not null and not exists(select 1 from public.service_variants where id=new.variant_id and service_id=new.service_id) then raise exception 'Invalid variant';end if;
 if new.customer_id is not null and not exists(select 1 from public.customers where id=new.customer_id and salon_id=salon) then raise exception 'Invalid customer';end if;
 if new.status in ('completed','no_show') and new.starts_at>now() then raise exception 'Appointment has not started';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.stylist_id::text,1));
 if new.status='cancelled' then return new;end if;
 if exists(select 1 from public.appointments a where a.id<>new.id and a.stylist_id=new.stylist_id and a.status<>'cancelled' and tstzrange(a.starts_at-make_interval(mins=>a.preparation_minutes),a.ends_at+make_interval(mins=>a.cleanup_minutes),'[)') && tstzrange(new.starts_at-make_interval(mins=>new.preparation_minutes),new.ends_at+make_interval(mins=>new.cleanup_minutes),'[)')) then raise exception 'Appointment conflict, including preparation and cleanup';end if;
 -- Check closures/blocks on creation or reschedule, not when completing an existing visit.
 if tg_op='INSERT' or new.starts_at<>old.starts_at or new.ends_at<>old.ends_at then
 if exists(select 1 from public.time_blocks b where b.stylist_id=new.stylist_id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.starts_at-make_interval(mins=>new.preparation_minutes),new.ends_at+make_interval(mins=>new.cleanup_minutes),'[)')) then raise exception 'Time off conflict';end if;
 if exists(select 1 from public.schedule_exceptions e where e.salon_id=salon and (e.stylist_id is null or e.stylist_id=new.stylist_id) and e.on_date between ((new.starts_at-make_interval(mins=>new.preparation_minutes)) at time zone tz)::date and ((new.ends_at+make_interval(mins=>new.cleanup_minutes)) at time zone tz)::date and (e.closed or ((new.starts_at-make_interval(mins=>new.preparation_minutes)) at time zone tz)::time<e.opens_at or ((new.ends_at+make_interval(mins=>new.cleanup_minutes)) at time zone tz)::time>e.closes_at)) then raise exception 'Special closure conflict';end if;
 -- Public reservation consumes a hold separately. Admin writes may not override any live hold.
 if auth.uid() is not null and exists(select 1 from public.appointment_holds h where h.stylist_id=new.stylist_id and h.consumed_at is null and h.expires_at>now() and tstzrange(h.starts_at,h.ends_at,'[)') && tstzrange(new.starts_at-make_interval(mins=>new.preparation_minutes),new.ends_at+make_interval(mins=>new.cleanup_minutes),'[)')) then raise exception 'A booking hold is active';end if;
 end if;return new;end $$;
revoke execute on function salon_private.guard_appointment() from public,anon,authenticated;
drop trigger protect_appointment_schedule on public.appointments;
create trigger protect_appointment_schedule before insert or update on public.appointments for each row execute function salon_private.guard_appointment();
-- Outbox always follows the current appointment; old reminders never survive a reschedule.
create function salon_private.sync_appointment_notifications() returns trigger language plpgsql security definer set search_path='' as $$ declare payload jsonb;begin
 if new.status<>'confirmed' then update public.notification_jobs set sent_at=coalesce(sent_at,now()),locked_until=null where appointment_id=new.id and sent_at is null;return null;end if;
 if new.email is null then return null;end if;
 if (tg_op='INSERT' and new.source<>'online') or (tg_op='UPDATE' and new.starts_at<>old.starts_at) then
 payload=jsonb_build_object('email',new.email,'name',new.client_name,'starts_at',new.starts_at,'reference',new.id);
 insert into public.notification_jobs(appointment_id,kind,payload,due_at) values(new.id,'confirmation',payload,now()),(new.id,'reminder',payload,greatest(now(),new.starts_at-interval '24 hours')) on conflict(appointment_id,kind) do update set payload=excluded.payload,due_at=excluded.due_at,sent_at=null,attempts=0,locked_until=null;
 end if;return null;end $$;
revoke execute on function salon_private.sync_appointment_notifications() from public,anon,authenticated;
create trigger sync_appointment_notifications after insert or update on public.appointments for each row execute function salon_private.sync_appointment_notifications();
-- Manager RPC stays SECURITY INVOKER: tenant RLS applies to every read and write.
create function public.admin_create_appointment(p_salon uuid,p_customer uuid,p_service uuid,p_variant uuid,p_stylist uuid,p_start timestamptz,p_duration integer,p_price integer,p_source text,p_notes text,p_request uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare c public.customers; s public.services; v public.service_variants; label text; ref uuid; prep integer; cleanup integer; bundled boolean;begin
 if not public.can_manage_salon(p_salon) then raise exception 'Access denied';end if;
 if p_source not in ('phone','walk_in') or p_duration not between 1 and 480 or p_price not between 0 and 1000000 or length(p_notes)>2000 or p_start is null or p_request is null then raise exception 'Invalid appointment';end if;
 select id into ref from public.appointments where id=p_request; if ref is not null then return ref;end if;
 select * into strict c from public.customers where id=p_customer and salon_id=p_salon;
 select * into strict s from public.services where id=p_service and salon_id=p_salon and status<>'archived';
 label=s.name;prep=s.preparation_minutes;cleanup=s.cleanup_minutes;bundled=s.includes_cut_style;
 if p_variant is not null then select * into strict v from public.service_variants where id=p_variant and service_id=s.id and status<>'archived';label=label||' — '||v.name;prep=v.preparation_minutes;cleanup=v.cleanup_minutes;bundled=v.includes_cut_style;
 elsif exists(select 1 from public.service_variants where service_id=s.id and status<>'archived' and active) then raise exception 'Choose a service variant';end if;
 insert into public.appointments(id,service_id,variant_id,stylist_id,starts_at,ends_at,client_name,email,phone,price_cents,customer_id,preparation_minutes,cleanup_minutes,pricing_type,service_snapshot,source,notes) values(p_request,s.id,p_variant,p_stylist,p_start,p_start+make_interval(mins=>p_duration),c.name,c.email,c.phone,p_price,c.id,prep,cleanup,'exact',jsonb_build_object('name',label,'duration_minutes',p_duration,'price_cents',p_price,'includes_cut_style',bundled,'manual_estimate',true),p_source,p_notes) returning id into ref;
 return ref;end $$;
create function public.admin_update_appointment(p_id uuid,p_revision integer,p_start timestamptz,p_duration integer,p_price integer,p_status text,p_notes text) returns uuid language plpgsql security invoker set search_path='' as $$ declare ref uuid;begin
 if auth.uid() is null or p_start is null or p_duration not between 1 and 480 or p_price not between 0 and 1000000 or length(p_notes)>2000 or p_status not in ('confirmed','cancelled','completed','no_show') then raise exception 'Invalid appointment';end if;
 update public.appointments set starts_at=p_start,ends_at=p_start+make_interval(mins=>p_duration),price_cents=p_price,status=p_status,notes=p_notes where id=p_id and revision=p_revision returning id into ref;
 if ref is null then raise exception 'Record changed or access denied. Reload before editing.';end if;return ref;end $$;
revoke execute on function public.admin_create_appointment(uuid,uuid,uuid,uuid,uuid,timestamptz,integer,integer,text,text,uuid),public.admin_update_appointment(uuid,integer,timestamptz,integer,integer,text,text) from public,anon;
grant execute on function public.admin_create_appointment(uuid,uuid,uuid,uuid,uuid,timestamptz,integer,integer,text,text,uuid),public.admin_update_appointment(uuid,integer,timestamptz,integer,integer,text,text) to authenticated;
-- Category changes propagate to variants without changing the chemical bundle guarantee.
create or replace function public.validate_catalog_update() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if length(trim(new.category)) not between 2 and 60 then raise exception 'Invalid category';end if;
 if tg_op='UPDATE' then
 if new.salon_id<>old.salon_id or new.id<>old.id or new.slug<>old.slug then raise exception 'Catalog identity cannot be changed';end if;
 if old.includes_cut_style then new.includes_cut_style=true;end if;
 if tg_table_name='service_variants' then if new.service_id<>old.service_id then raise exception 'Variant parent cannot change';end if;end if;
 new.revision=old.revision+1;end if;
 if upper(new.category) in ('COLOR','PERMS') or new.slug='brazilian-blowout' then new.includes_cut_style=true;end if;
 if tg_table_name='service_variants' then
 select category,includes_cut_style into new.category,new.includes_cut_style from public.services where id=new.service_id and salon_id=new.salon_id;
 if not found then raise exception 'Invalid variant parent';end if;end if;
 return new;end $$;
create function public.sync_variant_category() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.category<>old.category or new.includes_cut_style<>old.includes_cut_style then update public.service_variants set category=new.category,includes_cut_style=new.includes_cut_style where service_id=new.id;end if;return null;end $$;
create trigger sync_variant_category after update on public.services for each row execute function public.sync_variant_category();
create or replace function public.available_slots(p_service uuid,p_date date,p_variant uuid default null,p_hold uuid default null) returns table(starts_at timestamptz,stylist_id uuid) language sql stable security invoker set search_path='' as $$
 select distinct t,a.stylist_id from public.booking_item(p_service,p_variant) s join public.booking_policies p on p.salon_id=s.salon_id join public.locations l on l.salon_id=s.salon_id join public.stylists st on st.location_id=l.id and st.active join public.staff staff on staff.stylist_id=st.id and staff.active join lateral (
 select av.starts_at,av.ends_at,av.stylist_id from public.availability av where av.stylist_id=st.id
 union
 select (p_date+w.opens_at) at time zone l.timezone,(p_date+w.closes_at) at time zone l.timezone,w.stylist_id
 from public.working_hours w where w.stylist_id=st.id and w.weekday=extract(dow from p_date)
 ) a on true cross join lateral generate_series(a.starts_at+make_interval(mins=>s.preparation_minutes),a.ends_at-make_interval(mins=>s.duration_minutes+s.cleanup_minutes),make_interval(mins=>p.slot_interval_minutes)) t
 where s.active and s.status='published' and s.price_approved and s.duration_approved and s.duration_minutes is not null and s.price_cents is not null and s.pricing_type in ('exact','starting')
 and (t at time zone l.timezone)::date=p_date and t>=now()+make_interval(mins=>p.minimum_notice_minutes) and t<=now()+make_interval(days=>p.maximum_advance_days)
 and (not exists(select 1 from public.business_hours h where h.salon_id=s.salon_id) or exists(select 1 from public.business_hours h where h.salon_id=s.salon_id and h.weekday=extract(dow from t at time zone l.timezone) and ((t-make_interval(mins=>s.preparation_minutes)) at time zone l.timezone)::time>=h.opens_at and ((t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes)) at time zone l.timezone)::date=p_date and ((t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes)) at time zone l.timezone)::time<=h.closes_at))
 and not exists(select 1 from public.schedule_exceptions e where e.salon_id=s.salon_id and (e.stylist_id is null or e.stylist_id=st.id) and e.on_date=p_date and (e.closed or ((t-make_interval(mins=>s.preparation_minutes)) at time zone l.timezone)::time<e.opens_at or ((t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes)) at time zone l.timezone)::time>e.closes_at))
 and not exists(select 1 from public.time_blocks b where b.stylist_id=st.id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(t-make_interval(mins=>s.preparation_minutes),t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes),'[)'))
 and not exists(select 1 from public.appointments b where b.stylist_id=a.stylist_id and b.status<>'cancelled' and tstzrange(b.starts_at-make_interval(mins=>b.preparation_minutes),b.ends_at+make_interval(mins=>b.cleanup_minutes),'[)') && tstzrange(t-make_interval(mins=>s.preparation_minutes),t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes),'[)'))
 and not exists(select 1 from public.appointment_holds h where h.stylist_id=a.stylist_id and h.consumed_at is null and h.expires_at>now() and (p_hold is null or h.id<>p_hold) and tstzrange(h.starts_at,h.ends_at,'[)') && tstzrange(t-make_interval(mins=>s.preparation_minutes),t+make_interval(mins=>s.duration_minutes+s.cleanup_minutes),'[)')) order by t;
$$;

create or replace function public.edit_catalog_entry(p_kind text,p_id uuid,p_revision integer,p_values jsonb) returns integer language plpgsql security invoker set search_path='' as $$ declare v_count integer; begin
 if not (select auth.uid() is not null) then raise exception 'Sign in required'; end if;
 if p_kind not in ('service','variant') then raise exception 'Invalid entry type'; end if;
 if p_values - array['name','description','pricing_type','price_cents','price_max_cents','duration_minutes','duration_min_minutes','duration_max_minutes','price_approved','duration_approved','status','length_qualification','display_order','preparation_minutes','cleanup_minutes','admin_notes','category','active'] <> '{}'::jsonb then raise exception 'Unexpected fields'; end if;
 if p_kind='service' then
 update public.services set category=coalesce(p_values->>'category',category),active=coalesce((p_values->>'active')::boolean,active),name=p_values->>'name',description=p_values->>'description',pricing_type=p_values->>'pricing_type',price_cents=(p_values->>'price_cents')::integer,price_max_cents=(p_values->>'price_max_cents')::integer,duration_minutes=(p_values->>'duration_minutes')::integer,duration_min_minutes=(p_values->>'duration_min_minutes')::integer,duration_max_minutes=(p_values->>'duration_max_minutes')::integer,price_approved=(p_values->>'price_approved')::boolean,duration_approved=(p_values->>'duration_approved')::boolean,status=p_values->>'status',length_qualification=p_values->>'length_qualification',display_order=(p_values->>'display_order')::integer,preparation_minutes=(p_values->>'preparation_minutes')::integer,cleanup_minutes=(p_values->>'cleanup_minutes')::integer,admin_notes=p_values->>'admin_notes' where id=p_id and revision=p_revision;
 else
 update public.service_variants set active=coalesce((p_values->>'active')::boolean,active),name=p_values->>'name',description=p_values->>'description',pricing_type=p_values->>'pricing_type',price_cents=(p_values->>'price_cents')::integer,price_max_cents=(p_values->>'price_max_cents')::integer,duration_minutes=(p_values->>'duration_minutes')::integer,duration_min_minutes=(p_values->>'duration_min_minutes')::integer,duration_max_minutes=(p_values->>'duration_max_minutes')::integer,price_approved=(p_values->>'price_approved')::boolean,duration_approved=(p_values->>'duration_approved')::boolean,status=p_values->>'status',length_qualification=p_values->>'length_qualification',display_order=(p_values->>'display_order')::integer,preparation_minutes=(p_values->>'preparation_minutes')::integer,cleanup_minutes=(p_values->>'cleanup_minutes')::integer,admin_notes=p_values->>'admin_notes' where id=p_id and revision=p_revision;
 end if;
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'This entry changed or access was denied. Reload before editing.'; end if;
 return p_revision+1; end $$;
revoke execute on function public.edit_catalog_entry(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.edit_catalog_entry(text,uuid,integer,jsonb) to authenticated;

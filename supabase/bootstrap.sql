-- Run once in a new Supabase project's SQL editor. No client records are seeded.
create extension if not exists btree_gist;
create table public.locations(id uuid primary key default gen_random_uuid(),name text not null,timezone text not null default 'America/Chicago');
create table public.stylists(id uuid primary key default gen_random_uuid(),location_id uuid not null references public.locations,name text not null,active boolean not null default true);
create table public.salon_admins(user_id uuid primary key references auth.users on delete cascade);
create function public.is_salon_admin() returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.salon_admins where user_id=(select auth.uid())) $$;
create table public.services(id uuid primary key default gen_random_uuid(),name text not null,description text not null default '',category text not null,duration_minutes integer not null check(duration_minutes between 15 and 480),price_cents integer not null check(price_cents>=0),active boolean not null default true);
create table public.availability(id uuid primary key default gen_random_uuid(),stylist_id uuid not null references public.stylists,starts_at timestamptz not null,ends_at timestamptz not null,check(ends_at>starts_at),exclude using gist(stylist_id with =,tstzrange(starts_at,ends_at,'[)') with &&));
create table public.appointments(id uuid primary key default gen_random_uuid(),service_id uuid not null references public.services,stylist_id uuid not null references public.stylists,starts_at timestamptz not null,ends_at timestamptz not null,client_name text not null,email text not null,phone text not null,status text not null default 'confirmed' check(status in ('confirmed','completed','cancelled')),price_cents integer not null,created_at timestamptz not null default now(),check(ends_at>starts_at),exclude using gist(stylist_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status <> 'cancelled'));
create index on public.appointments(email,created_at);
create table public.notification_jobs(id uuid primary key default gen_random_uuid(),appointment_id uuid not null references public.appointments,kind text not null check(kind in ('confirmation','reminder')),payload jsonb not null,due_at timestamptz not null,sent_at timestamptz,locked_until timestamptz,attempts integer not null default 0,unique(appointment_id,kind));
create index on public.notification_jobs(due_at) where sent_at is null;
alter table public.locations enable row level security;
alter table public.stylists enable row level security;
alter table public.salon_admins enable row level security;
alter table public.services enable row level security;
alter table public.availability enable row level security;
alter table public.appointments enable row level security;
alter table public.notification_jobs enable row level security;
create policy own_membership on public.salon_admins for select to authenticated using(user_id=(select auth.uid()));
create policy published_services on public.services for select to anon,authenticated using(active);
create policy manage_services on public.services for all to authenticated using(public.is_salon_admin()) with check(public.is_salon_admin());
create policy manage_locations on public.locations for all to authenticated using(public.is_salon_admin()) with check(public.is_salon_admin());
create policy manage_stylists on public.stylists for all to authenticated using(public.is_salon_admin()) with check(public.is_salon_admin());
create policy manage_hours on public.availability for all to authenticated using(public.is_salon_admin()) with check(public.is_salon_admin());
create policy manage_appointments on public.appointments for all to authenticated using(public.is_salon_admin()) with check(public.is_salon_admin());
-- Explicit grants; no anonymous access to clients, availability, or notification payloads.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.services to anon;
grant select on public.salon_admins to authenticated;
grant select,insert,update,delete on public.services,public.locations,public.stylists,public.availability,public.appointments to authenticated;
grant all on public.locations,public.stylists,public.salon_admins,public.services,public.availability,public.appointments,public.notification_jobs to service_role;
create function public.available_slots(p_service uuid,p_date date) returns table(starts_at timestamptz,stylist_id uuid) language sql security invoker set search_path='' as $$
 select t, a.stylist_id from public.availability a join public.stylists st on st.id=a.stylist_id and st.active join public.locations l on l.id=st.location_id cross join public.services s cross join lateral generate_series(a.starts_at,a.ends_at-make_interval(mins=>s.duration_minutes),interval '30 minutes') t
 where s.id=p_service and s.active and (t at time zone l.timezone)::date=p_date and t>now()+interval '2 hours' and t<now()+interval '90 days'
 and not exists(select 1 from public.appointments b where b.stylist_id=a.stylist_id and b.status<>'cancelled' and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(t,t+make_interval(mins=>s.duration_minutes),'[)')) order by t
$$;
create function public.reserve_appointment(p_service uuid,p_stylist uuid,p_start timestamptz,p_name text,p_email text,p_phone text) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_service public.services; v_id uuid; v_end timestamptz; v_payload jsonb; v_date date;
begin
 perform pg_advisory_xact_lock(hashtextextended(lower(p_email),0));
 if exists(select 1 from public.appointments where lower(email)=lower(p_email) and created_at>now()-interval '5 minutes') then raise exception 'Please wait before booking again'; end if;
 select * into strict v_service from public.services where id=p_service and active for share;
 select (p_start at time zone l.timezone)::date into v_date from public.stylists st join public.locations l on l.id=st.location_id where st.id=p_stylist and st.active;
 -- Lock published hours against removal during reservation.
 perform 1 from public.availability where stylist_id=p_stylist and starts_at<=p_start and ends_at>=p_start+make_interval(mins=>v_service.duration_minutes) for share;
 if not exists(select 1 from public.available_slots(p_service,v_date) s where s.starts_at=p_start and s.stylist_id=p_stylist) then raise exception 'Unavailable'; end if;
 v_end=p_start+make_interval(mins=>v_service.duration_minutes);
 insert into public.appointments(service_id,stylist_id,starts_at,ends_at,client_name,email,phone,price_cents) values(p_service,p_stylist,p_start,v_end,p_name,lower(p_email),p_phone,v_service.price_cents) returning id into v_id;
 v_payload=jsonb_build_object('email',p_email,'name',p_name,'starts_at',p_start,'reference',v_id);
 insert into public.notification_jobs(appointment_id,kind,payload,due_at) values(v_id,'confirmation',v_payload,now()),(v_id,'reminder',v_payload,greatest(now(),p_start-interval '24 hours'));
 return v_id;
end $$;
create function public.claim_notifications() returns setof public.notification_jobs language sql security invoker set search_path='' as $$
 update public.notification_jobs j set locked_until=now()+interval '5 minutes',attempts=attempts+1 where j.id in(select q.id from public.notification_jobs q join public.appointments a on a.id=q.appointment_id where a.status='confirmed' and q.sent_at is null and q.due_at<=now() and (q.locked_until is null or q.locked_until<now()) and q.attempts<10 order by q.due_at limit 25 for update of q skip locked) returning j.*
$$;
revoke execute on function public.available_slots(uuid,date),public.reserve_appointment(uuid,uuid,timestamptz,text,text,text),public.claim_notifications() from public,anon,authenticated;
grant execute on function public.available_slots(uuid,date),public.reserve_appointment(uuid,uuid,timestamptz,text,text,text),public.claim_notifications() to service_role;
insert into public.locations(name) values('Jaz It Up Beauty Lounge');
insert into public.stylists(location_id,name) select id,'Delia' from public.locations;

-- Preserve appointments and history. External delivery and deposits remain opt-in.
alter table public.booking_policies drop constraint booking_policies_payments_enabled_check;
alter table public.booking_policies add column refund_policy text not null default '' check(length(refund_policy)<=3000);
alter table public.booking_policies add column refund_mode text not null default 'manual_review' check(refund_mode in ('manual_review','refundable_before_deadline','nonrefundable'));
alter table public.booking_policies add constraint enabled_payment_policy check(not payments_enabled or (deposit_type<>'none' and deposit_value>0 and length(trim(cancellation_text))>=10 and length(trim(refund_policy))>=10 and cancellation_notice_hours is not null));
create table public.communication_settings(salon_id uuid primary key references public.salons,email_enabled boolean not null default false,sms_enabled boolean not null default false,reminders_enabled boolean not null default false,reminder_minutes integer[] not null default array[1440,120],revision integer not null default 1,check(cardinality(reminder_minutes) between 1 and 3 and 30<=all(reminder_minutes) and 10080>=all(reminder_minutes)));
insert into public.communication_settings(salon_id) select id from public.salons;
create table public.payment_readiness(salon_id uuid primary key references public.salons,credential_fingerprint text not null,account_id text,endpoint_id text,livemode boolean not null,verified_at timestamptz,webhook_seen_at timestamptz);
create table public.booking_requests(
 id uuid primary key, salon_id uuid not null references public.salons,token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
 request jsonb not null, item jsonb not null, policy_snapshot jsonb not null,
 hold_id uuid references public.appointment_holds,appointment_id uuid unique references public.appointments,
 status text not null check(status in ('pending','confirmed','expired','failed','refund_review','refunded')),
 estimate_cents integer not null check(estimate_cents between 0 and 1000000),deposit_cents integer not null check(deposit_cents between 0 and 1000000),
 paid_cents integer not null default 0 check(paid_cents>=0),refunded_cents integer not null default 0 check(refunded_cents>=0 and refunded_cents<=paid_cents),
 stripe_session_id text unique,stripe_payment_intent text unique,checkout_url text,livemode boolean not null default false,
 expires_at timestamptz not null,created_at timestamptz not null default now(),last_error text,
 check(deposit_cents<=estimate_cents)
);
create index booking_requests_salon on public.booking_requests(salon_id,created_at);
create index booking_requests_expiry on public.booking_requests(expires_at) where status='pending';
create index booking_requests_hold on public.booking_requests(hold_id);
create table public.provider_events(provider text not null,event_id text not null,event_type text not null,received_at timestamptz not null default now(),primary key(provider,event_id));
create table public.message_suppressions(salon_id uuid not null references public.salons,channel text not null check(channel in ('email','sms')),target text not null,reason text not null,created_at timestamptz not null default now(),primary key(salon_id,channel,target));
alter table public.appointments add column email_reminders_consent boolean not null default false;
alter table public.appointments add column sms_consent boolean not null default false;
alter table public.appointments add column consent_recorded_at timestamptz;
alter table public.appointments add column consent_version text;
-- Upgrade the existing outbox without deleting delivery history.
alter table public.notification_jobs drop constraint notification_jobs_appointment_id_kind_key;
alter table public.notification_jobs drop constraint notification_jobs_kind_check;
alter table public.notification_jobs add constraint notification_kind check(kind in ('confirmation','reschedule','cancellation','reminder'));
alter table public.notification_jobs add column salon_id uuid references public.salons;
update public.notification_jobs j set salon_id=s.salon_id from public.appointments a join public.services s on s.id=a.service_id where j.appointment_id=a.id;
alter table public.notification_jobs alter column salon_id set not null;
alter table public.notification_jobs add column channel text not null default 'email' check(channel in ('email','sms'));
alter table public.notification_jobs add column state text not null default 'pending' check(state in ('pending','processing','retry','accepted','delivered','failed','unknown','suppressed','bounced'));
alter table public.notification_jobs add column dedup_key text unique;
alter table public.notification_jobs add column lease_token uuid;
alter table public.notification_jobs add column first_attempt_at timestamptz;
alter table public.notification_jobs add column provider text;
alter table public.notification_jobs add column provider_id text;
alter table public.notification_jobs add column rendered jsonb;
alter table public.notification_jobs add column last_error text;
alter table public.notification_jobs add column expires_at timestamptz not null default (now()+interval '1 day');
alter table public.notification_jobs add column reminder_minutes integer;
update public.notification_jobs set state=case when sent_at is not null then 'accepted' else 'suppressed' end,last_error='Legacy queue retired; no unapproved reminders sent';
create index notification_jobs_salon on public.notification_jobs(salon_id,due_at);
create unique index notification_provider_id on public.notification_jobs(provider,provider_id) where provider_id is not null;
alter table public.notification_events drop constraint notification_events_event_type_check;
alter table public.notification_events add column detail text;
alter table public.notification_events add column attempt integer;
alter table public.notification_events add column idempotency_key text;
-- The new tables are private. Only policy fields are editable by salon owners.
do $$ declare t text;begin foreach t in array array['communication_settings','payment_readiness','booking_requests','provider_events','message_suppressions'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
end loop;end $$;
do $$ declare t text;begin foreach t in array array['communication_settings','payment_readiness','booking_requests','message_suppressions','notification_jobs'] loop
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy manager_read on public.%I for select to authenticated using(public.can_manage_salon(salon_id))',t);
end loop;end $$;
grant select on public.notification_events to authenticated;
create policy manager_read on public.notification_events for select to authenticated using(exists(select 1 from public.notification_jobs j where j.id=job_id and public.can_manage_salon(j.salon_id)));
grant update on public.communication_settings to authenticated;
create policy owner_update on public.communication_settings for update to authenticated using(exists(select 1 from public.staff_roles where salon_id=communication_settings.salon_id and user_id=auth.uid() and role='owner')) with check(exists(select 1 from public.staff_roles where salon_id=communication_settings.salon_id and user_id=auth.uid() and role='owner'));
create trigger communication_revision before update on public.communication_settings for each row execute function public.dashboard_revision();
create trigger audit_communication_settings after update on public.communication_settings for each row execute function salon_private.audit_operations();
create trigger audit_booking_requests after insert or update on public.booking_requests for each row execute function salon_private.audit_operations();
-- Owners cannot accidentally activate a policy without independently verified infrastructure.
create function salon_private.guard_payment_activation() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.payments_enabled then
 if auth.uid() is not null and not exists(select 1 from public.staff_roles where salon_id=new.salon_id and user_id=auth.uid() and role='owner') then raise exception 'Owner permission required';end if;
 if not exists(select 1 from public.payment_readiness where salon_id=new.salon_id and verified_at is not null and webhook_seen_at is not null) then raise exception 'Stripe credentials and signed webhook must be verified first';end if;
 end if;return new;end $$;
revoke all on function salon_private.guard_payment_activation() from public,anon,authenticated;
create trigger guard_payment_activation before insert or update on public.booking_policies for each row execute function salon_private.guard_payment_activation();

create function salon_private.enqueue_messages(p_id uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
declare a public.appointments;s uuid;settings public.communication_settings;body jsonb;ch text;minutes integer;due timestamptz;begin
 select * into strict a from public.appointments where id=p_id;select salon_id into s from public.services where id=a.service_id;
 select * into settings from public.communication_settings where salon_id=s;
 select jsonb_build_object('email',a.email,'phone',a.phone,'name',a.client_name,'starts_at',a.starts_at,'ends_at',a.ends_at,'reference',a.id,'service',coalesce(a.service_snapshot->>'name',v.name),'salon',sa.name,'timezone',sa.timezone,'salon_phone',coalesce(pr.phone,''),'salon_email',coalesce(pr.email,''),'address',coalesce(pr.address,'')) into body from public.salons sa join public.services v on v.id=a.service_id left join public.salon_profiles pr on pr.salon_id=sa.id where sa.id=s;
 foreach ch in array array['email','sms'] loop
 if (ch='email' and a.email is null) or (ch='sms' and (not a.sms_consent or a.phone !~ '^\+[1-9][0-9]{7,14}$')) then continue;end if;
 if p_kind<>'reminder' then
 insert into public.notification_jobs(salon_id,appointment_id,kind,channel,payload,due_at,dedup_key,generation,expires_at) values(s,a.id,p_kind,ch,body,now(),a.id||':'||a.revision||':'||p_kind||':'||ch,a.revision,now()+interval '24 hours') on conflict(dedup_key) do nothing;
 elsif settings.reminders_enabled and (ch='sms' or a.email_reminders_consent) and a.status='confirmed' then
 foreach minutes in array settings.reminder_minutes loop
 due=a.starts_at-make_interval(mins=>minutes);
 -- Short-notice bookings do not receive an immediate stale reminder.
 if due<=now() then continue;end if;
 insert into public.notification_jobs(salon_id,appointment_id,kind,channel,payload,due_at,dedup_key,generation,expires_at,reminder_minutes) values(s,a.id,'reminder',ch,body,due,a.id||':'||extract(epoch from a.starts_at)::bigint||':reminder:'||ch||':'||minutes,a.revision,least(a.starts_at,due+interval '30 minutes'),minutes) on conflict(dedup_key) do nothing;
 end loop;end if;end loop;
end $$;
revoke all on function salon_private.enqueue_messages(uuid,text) from public,anon,authenticated;
create or replace function salon_private.sync_appointment_notifications() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then
 if new.status='confirmed' then perform salon_private.enqueue_messages(new.id,'confirmation');perform salon_private.enqueue_messages(new.id,'reminder');end if;
 elsif new.status<>old.status or new.starts_at<>old.starts_at or new.ends_at<>old.ends_at then
 update public.notification_jobs set state='suppressed',locked_until=null,last_error='Appointment changed' where appointment_id=new.id and state in ('pending','retry','processing');
 if new.status='cancelled' and old.status='confirmed' then perform salon_private.enqueue_messages(new.id,'cancellation');
 elsif new.status='confirmed' then perform salon_private.enqueue_messages(new.id,'reschedule');perform salon_private.enqueue_messages(new.id,'reminder');end if;
 elsif new.email_reminders_consent is distinct from old.email_reminders_consent or new.sms_consent is distinct from old.sms_consent then
 perform salon_private.enqueue_messages(new.id,'reminder');
 end if;return null;end $$;
-- Rebuilding reminder proposals requires explicit owner approval, and keeps sent keys intact.
create function salon_private.refresh_reminders() returns trigger language plpgsql security definer set search_path='' as $$ declare a uuid;begin
 update public.notification_jobs set state='suppressed',last_error='Reminder policy changed' where salon_id=new.salon_id and kind='reminder' and state in ('pending','retry','processing');
 if new.reminders_enabled then
 for a in select ap.id from public.appointments ap join public.services s on s.id=ap.service_id where s.salon_id=new.salon_id and ap.status='confirmed' and ap.starts_at>now() loop perform salon_private.enqueue_messages(a,'reminder');end loop;
 update public.notification_jobs j set state='pending',last_error=null where j.salon_id=new.salon_id and j.kind='reminder' and j.state='suppressed' and j.first_attempt_at is null and j.due_at>now() and j.reminder_minutes=any(new.reminder_minutes) and exists(select 1 from public.appointments a where a.id=j.appointment_id and a.status='confirmed' and (j.payload->>'starts_at')::timestamptz=a.starts_at);
 end if;return null;end $$;
revoke all on function salon_private.refresh_reminders() from public,anon,authenticated;
create trigger refresh_reminders after update on public.communication_settings for each row execute function salon_private.refresh_reminders();

-- All appointment creation uses the transactional notification trigger.
create or replace function public.reserve_appointment(p_service uuid,p_stylist uuid,p_start timestamptz,p_name text,p_email text,p_phone text,p_variant uuid default null,p_hold uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
 declare item public.services; ref uuid; customer uuid; tz text; payload jsonb;
 begin
 perform pg_advisory_xact_lock(hashtextextended(lower(p_email),0));
 perform pg_advisory_xact_lock(hashtextextended(p_stylist::text,1));
 perform 1 from public.services where id=p_service for share;
 perform 1 from public.service_variants where id=p_variant for share;
 select * into strict item from public.booking_item(p_service,p_variant);
 if exists(select 1 from public.booking_policies where salon_id=item.salon_id and payments_enabled) then raise exception 'Use verified deposit checkout';end if;
 select timezone into tz from public.salons where id=item.salon_id;
 if length(trim(p_name)) not between 2 and 100 or length(p_email)>254 or p_email not like '%@%' or length(p_phone) not between 7 and 30 then raise exception 'Invalid customer'; end if;
 if exists(select 1 from public.appointments where lower(email)=lower(p_email) and created_at>now()-interval '5 minutes') then raise exception 'Booking cooldown'; end if;
 if p_hold is not null and not exists(select 1 from public.appointment_holds where id=p_hold and service_id=p_service and variant_id is not distinct from p_variant and stylist_id=p_stylist and starts_at=p_start-make_interval(mins=>item.preparation_minutes) and expires_at>now() and consumed_at is null) then raise exception 'Invalid hold'; end if;
 perform 1 from public.services where id=p_service for share;
 perform 1 from public.service_variants where id=p_variant for share;
 perform 1 from public.availability where stylist_id=p_stylist and starts_at<=p_start and ends_at>=p_start+make_interval(mins=>item.duration_minutes+item.cleanup_minutes) for share;
 if not exists(select 1 from public.available_slots(p_service,(p_start at time zone tz)::date,p_variant,p_hold) where starts_at=p_start and stylist_id=p_stylist) then raise exception 'Unavailable or requires owner review'; end if;
 insert into public.customers(salon_id,name,email,phone) values(item.salon_id,trim(p_name),lower(trim(p_email)),p_phone) on conflict(salon_id,email) do update set name=excluded.name,phone=excluded.phone returning id into customer;
 insert into public.appointments(service_id,variant_id,stylist_id,starts_at,ends_at,client_name,email,phone,price_cents,customer_id,preparation_minutes,cleanup_minutes,pricing_type,service_snapshot,email_reminders_consent,sms_consent,consent_recorded_at,consent_version) values(p_service,p_variant,p_stylist,p_start,p_start+make_interval(mins=>item.duration_minutes),trim(p_name),lower(p_email),p_phone,item.price_cents,customer,item.preparation_minutes,item.cleanup_minutes,item.pricing_type,jsonb_build_object('name',item.name,'includes_cut_style',item.includes_cut_style,'duration_minutes',item.duration_minutes,'price_cents',item.price_cents,'pricing_type',item.pricing_type,'length_qualification',item.length_qualification),coalesce((nullif(current_setting('salon.booking_consent',true),'')::jsonb->>'email_reminders_consent')::boolean,false),coalesce((nullif(current_setting('salon.booking_consent',true),'')::jsonb->>'sms_consent')::boolean,false),now(),'booking-v1') returning id into ref;
 update public.appointment_holds set consumed_at=now() where id=p_hold;
 return ref; end $$;
-- Old deployed workers must not claim new jobs during a rolling upgrade.
create or replace function public.claim_notifications() returns setof public.notification_jobs language sql security invoker set search_path='' as $$ select * from public.notification_jobs where false $$;
create function public.message_is_current(p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.notification_jobs j join public.appointments a on a.id=j.appointment_id join public.communication_settings s on s.salon_id=j.salon_id
 where j.id=p_id and j.expires_at>now() and ((j.kind='cancellation' and a.status='cancelled') or (j.kind<>'cancellation' and a.status='confirmed' and (j.payload->>'starts_at')::timestamptz=a.starts_at))
 and ((j.channel='email' and s.email_enabled) or (j.channel='sms' and s.sms_enabled and a.sms_consent))
 and (j.kind<>'reminder' or (s.reminders_enabled and j.reminder_minutes=any(s.reminder_minutes) and (j.channel='sms' or a.email_reminders_consent)))
 and not exists(select 1 from public.message_suppressions x where x.salon_id=j.salon_id and x.channel=j.channel and x.target=case when j.channel='email' then lower(j.payload->>'email') else j.payload->>'phone' end));
$$;
create function public.claim_messages(p_channel text) returns setof public.notification_jobs language plpgsql security invoker set search_path='' as $$ begin
 -- Never retry a possible SMS acceptance or an email beyond the provider's 24h key retention.
 update public.notification_jobs set state='unknown',locked_until=null,last_error='Acceptance uncertain; reconcile provider before any resend' where state in ('retry','processing') and ((first_attempt_at<now()-interval '23 hours') or (channel='sms' and state='processing' and locked_until<now()));
 update public.notification_jobs set state='suppressed',locked_until=null,last_error='Expired, opted out, disabled or appointment changed' where state in ('pending','retry','processing') and not public.message_is_current(id);
 return query update public.notification_jobs j set state='processing',lease_token=gen_random_uuid(),locked_until=now()+interval '5 minutes',attempts=j.attempts+1,first_attempt_at=coalesce(j.first_attempt_at,now()) where j.id in(select q.id from public.notification_jobs q where q.channel=p_channel and q.state in ('pending','retry','processing') and q.due_at<=now() and (q.locked_until is null or q.locked_until<now()) and q.attempts<8 and public.message_is_current(q.id) order by q.due_at limit 10 for update skip locked) returning j.*;
end $$;
create function public.freeze_message(p_id uuid,p_lease uuid,p_provider text,p_body jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$ declare j public.notification_jobs;begin
 select * into strict j from public.notification_jobs where id=p_id for update;
 if j.state<>'processing' or j.lease_token<>p_lease or j.locked_until<=now() or not public.message_is_current(p_id) then return null;end if;
 if j.rendered is not null and j.rendered->>'configurationFingerprint' is distinct from p_body->>'configurationFingerprint' then raise exception 'Credentials changed during retry';end if;
 if j.provider is not null and j.provider<>p_provider then raise exception 'Provider changed during retry';end if;
 update public.notification_jobs set rendered=coalesce(rendered,p_body),provider=p_provider where id=p_id returning rendered into p_body;
 insert into public.notification_events(job_id,event_type,attempt,idempotency_key) values(p_id,'attempted',j.attempts,j.id::text);
 return p_body;end $$;
create function public.finish_message(p_id uuid,p_lease uuid,p_state text,p_provider_id text default null,p_error text default null) returns boolean language plpgsql security invoker set search_path='' as $$ declare j public.notification_jobs;begin
 if p_state not in ('accepted','retry','failed','unknown') then raise exception 'Invalid result';end if;
 update public.notification_jobs set state=case when p_state='retry' and attempts>=8 then 'failed' else p_state end,provider_id=coalesce(p_provider_id,provider_id),sent_at=case when p_state='accepted' then now() else sent_at end,last_error=left(p_error,200),locked_until=case when p_state='retry' then now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)) else null end where id=p_id and lease_token=p_lease and state='processing' returning * into j;
 if not found then return false;end if;
 insert into public.notification_events(job_id,event_type,attempt,idempotency_key,provider_reference,detail) values(p_id,j.state,j.attempts,j.id::text,j.provider_id,j.last_error);return true;end $$;

-- Request IDs and random capability hashes make a retried browser submission safe.
create function public.begin_booking(p_id uuid,p_token_hash text,p_booking jsonb,p_fingerprint text default null,p_livemode boolean default false) returns public.booking_requests language plpgsql security invoker set search_path='' as $$
declare r public.booking_requests;i public.services;p public.booking_policies;h uuid;ref uuid;deposit integer;begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,2));
 select * into r from public.booking_requests where id=p_id;
 if found then if r.token_hash<>p_token_hash or r.request<>p_booking then raise exception 'Request identity mismatch';end if;return r;end if;
 select * into strict i from public.booking_item((p_booking->>'service_id')::uuid,(p_booking->>'variant_id')::uuid);
 select * into strict p from public.booking_policies where salon_id=i.salon_id for share;
 if length(trim(p_booking->>'name')) not between 2 and 100 or length(p_booking->>'email')>254 or p_booking->>'email' not like '%@%' or length(p_booking->>'phone') not between 7 and 30 then raise exception 'Invalid customer';end if;
 if coalesce((p_booking->>'sms_consent')::boolean,false) and p_booking->>'phone' !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'SMS requires an international-format phone';end if;
 deposit=0;
 if p.payments_enabled then
 if p_fingerprint is null or not exists(select 1 from public.payment_readiness where salon_id=i.salon_id and credential_fingerprint=p_fingerprint and livemode=p_livemode and verified_at is not null and webhook_seen_at is not null) then raise exception 'Payments are not configured';end if;
 deposit=least(i.price_cents,case when p.deposit_type='fixed' then p.deposit_value else ceil(i.price_cents::numeric*p.deposit_value/100)::integer end);
 if deposit<50 then raise exception 'Deposit must be at least 50 cents';end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(p_booking->>'email'),0));
 if exists(select 1 from public.booking_requests where lower(request->>'email')=lower(p_booking->>'email') and created_at>now()-interval '5 minutes') then raise exception 'Booking cooldown';end if;
 h=public.create_appointment_hold((p_booking->>'service_id')::uuid,(p_booking->>'stylist_id')::uuid,(p_booking->>'starts_at')::timestamptz,(p_booking->>'variant_id')::uuid);
 -- Stripe Checkout requires at least 30 minutes. Fixed expiry is not extended on retry.
 update public.appointment_holds set expires_at=date_trunc('second',now()+interval '35 minutes') where id=h;
 else
 perform set_config('salon.booking_consent',p_booking::text,true);
 ref=public.reserve_appointment((p_booking->>'service_id')::uuid,(p_booking->>'stylist_id')::uuid,(p_booking->>'starts_at')::timestamptz,p_booking->>'name',p_booking->>'email',p_booking->>'phone',(p_booking->>'variant_id')::uuid);
 perform set_config('salon.booking_consent','',true);
 end if;
 insert into public.booking_requests(id,salon_id,token_hash,request,item,policy_snapshot,hold_id,appointment_id,status,estimate_cents,deposit_cents,livemode,expires_at) values(p_id,i.salon_id,p_token_hash,p_booking,to_jsonb(i),jsonb_build_object('deposit_type',p.deposit_type,'deposit_value',p.deposit_value,'cancellation_text',p.cancellation_text,'cancellation_notice_hours',p.cancellation_notice_hours,'refund_mode',p.refund_mode,'refund_policy',p.refund_policy),h,ref,case when ref is null then 'pending' else 'confirmed' end,i.price_cents,deposit,p_livemode,date_trunc('second',now()+interval '35 minutes')) returning * into r;
 return r;end $$;
create function public.attach_checkout(p_id uuid,p_session text,p_url text) returns boolean language plpgsql security invoker set search_path='' as $$ begin
 update public.booking_requests set stripe_session_id=p_session,checkout_url=p_url where id=p_id and status='pending' and (stripe_session_id is null or stripe_session_id=p_session);return found;end $$;
create function public.apply_payment_event(p_event text,p_type text,p_id uuid,p_session text,p_intent text,p_amount integer,p_currency text,p_livemode boolean) returns text language plpgsql security invoker set search_path='' as $$
declare r public.booking_requests;c uuid;a uuid;h public.appointment_holds;b jsonb;i jsonb;begin
 select * into strict r from public.booking_requests where id=p_id for update;
 if r.deposit_cents<50 or r.livemode<>p_livemode or p_currency<>'usd' or p_amount<>r.deposit_cents or (r.stripe_session_id is not null and r.stripe_session_id<>p_session) then raise exception 'Payment identity or amount mismatch';end if;
 if p_type='paid' and (p_intent is null or p_intent not like 'pi_%') then raise exception 'Payment intent required';end if;
 if p_type not in ('paid','failed','expired') then raise exception 'Invalid payment event';end if;
 insert into public.provider_events(provider,event_id,event_type) values('stripe',p_event,p_type) on conflict do nothing;
 if not found then return r.status;end if;
 b=r.request;i=r.item;
 perform pg_advisory_xact_lock(hashtextextended((b->>'stylist_id'),1));
 select * into h from public.appointment_holds where id=r.hold_id for update;
 if p_type<>'paid' then
 if r.paid_cents=0 and r.status='pending' then update public.booking_requests set status=p_type,stripe_session_id=p_session where id=r.id;update public.appointment_holds set expires_at=least(expires_at,now()) where id=h.id;end if;
 return p_type;
 end if;
 if r.paid_cents>0 then return r.status;end if;
 update public.booking_requests set paid_cents=p_amount,stripe_session_id=p_session,stripe_payment_intent=p_intent where id=r.id;
 -- Late success never takes a slot that was released. Reconcile/refund it in Stripe.
 if r.status<>'pending' or h.expires_at<=now() or h.consumed_at is not null then
 update public.booking_requests set status='refund_review',last_error='Payment arrived after the slot hold ended; refund required' where id=r.id;return 'refund_review';end if;
 begin
 insert into public.customers(salon_id,name,email,phone) values(r.salon_id,trim(b->>'name'),lower(b->>'email'),b->>'phone') on conflict(salon_id,email) do update set name=excluded.name,phone=excluded.phone returning id into c;
 insert into public.appointments(service_id,variant_id,stylist_id,starts_at,ends_at,client_name,email,phone,price_cents,customer_id,preparation_minutes,cleanup_minutes,pricing_type,service_snapshot,email_reminders_consent,sms_consent,consent_recorded_at,consent_version) values((b->>'service_id')::uuid,(b->>'variant_id')::uuid,(b->>'stylist_id')::uuid,(b->>'starts_at')::timestamptz,(b->>'starts_at')::timestamptz+make_interval(mins=>(i->>'duration_minutes')::integer),b->>'name',lower(b->>'email'),b->>'phone',r.estimate_cents,c,(i->>'preparation_minutes')::integer,(i->>'cleanup_minutes')::integer,i->>'pricing_type',i-array['admin_notes','salon_id'],coalesce((b->>'email_reminders_consent')::boolean,false),coalesce((b->>'sms_consent')::boolean,false),now(),'booking-v1') returning id into a;
 update public.appointment_holds set consumed_at=now() where id=h.id;
 update public.booking_requests set status='confirmed',appointment_id=a,last_error=null where id=r.id;
 exception when others then
 update public.booking_requests set status='refund_review',last_error='Paid booking could not be fulfilled; operator refund review required' where id=r.id;
 update public.appointment_holds set expires_at=least(expires_at,now()) where id=h.id;
 return 'refund_review';end;
 return 'confirmed';end $$;
create function public.apply_refund_event(p_event text,p_intent text,p_refunded integer) returns void language plpgsql security invoker set search_path='' as $$ declare r public.booking_requests;begin
 select * into strict r from public.booking_requests where stripe_payment_intent=p_intent for update;
 if p_refunded<0 or p_refunded>r.paid_cents then raise exception 'Invalid refund total';end if;
 insert into public.provider_events(provider,event_id,event_type) values('stripe',p_event,'refund') on conflict do nothing;if not found then return;end if;
 update public.booking_requests set refunded_cents=greatest(refunded_cents,p_refunded),status=case when p_refunded=paid_cents and appointment_id is null then 'refunded' else status end where id=r.id;
end $$;
create function public.expire_checkouts() returns integer language plpgsql security invoker set search_path='' as $$ declare n integer;begin
 update public.booking_requests set status='expired',last_error='Checkout hold expired' where status='pending' and expires_at<=now();get diagnostics n=row_count;return n;end $$;
-- Only service credentials may invoke delivery/payment operations; no anonymous writes.
do $$ declare f regprocedure;begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('message_is_current','claim_messages','freeze_message','finish_message','begin_booking','attach_checkout','apply_payment_event','apply_refund_event','expire_checkouts') loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;
end $$;
create function public.suppress_contact(p_salon uuid,p_channel text,p_target text,p_reason text) returns void language plpgsql security invoker set search_path='' as $$ begin
 if p_channel not in ('email','sms') or p_reason not in ('customer_opt_out','provider_opt_out','bounced','complained') then raise exception 'Invalid suppression';end if;
 insert into public.message_suppressions(salon_id,channel,target,reason) values(p_salon,p_channel,case when p_channel='email' then lower(p_target) else p_target end,p_reason) on conflict(salon_id,channel,target) do nothing;
 update public.notification_jobs set state='suppressed',last_error='Contact opted out',locked_until=null where salon_id=p_salon and channel=p_channel and state in ('pending','retry','processing') and case when p_channel='email' then lower(payload->>'email')=lower(p_target) else payload->>'phone'=p_target end;
end $$;
create function public.record_delivery_event(p_provider text,p_event text,p_message text,p_status text) returns boolean language plpgsql security invoker set search_path='' as $$ declare j public.notification_jobs;begin
 if p_status not in ('delivered','bounced','complained','failed') then raise exception 'Invalid delivery event';end if;
 select * into j from public.notification_jobs where provider=p_provider and provider_id=p_message for update;if not found then return false;end if;
 insert into public.provider_events(provider,event_id,event_type) values(p_provider,p_event,p_status) on conflict do nothing;if not found then return true;end if;
 update public.notification_jobs set state=case when p_status in ('bounced','complained') then 'bounced' when state='bounced' then state else p_status end,last_error=case when p_status<>'delivered' then p_status else last_error end where id=j.id;
 insert into public.notification_events(job_id,event_type,idempotency_key,provider_reference) values(j.id,p_status,j.id::text,p_message);
 if p_status in ('bounced','complained') then perform public.suppress_contact(j.salon_id,j.channel,case when j.channel='email' then j.payload->>'email' else j.payload->>'phone' end,p_status);end if;return true;end $$;
revoke all on function public.suppress_contact(uuid,text,text,text),public.record_delivery_event(text,text,text,text) from public,anon,authenticated;
grant execute on function public.suppress_contact(uuid,text,text,text),public.record_delivery_event(text,text,text,text) to service_role;

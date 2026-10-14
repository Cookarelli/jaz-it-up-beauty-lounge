-- Aggregate inside Postgres so dashboard reports never silently truncate at a REST row limit.
create function public.admin_report(p_salon uuid,p_from timestamptz,p_to timestamptz) returns table(status text,visits bigint,estimated_cents bigint) language plpgsql stable security invoker set search_path='' as $$ begin
 if not public.can_manage_salon(p_salon) then raise exception 'Access denied';end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to>p_from+interval '367 days' then raise exception 'Choose a valid date range up to one year';end if;
 return query select a.status,count(*),sum(a.price_cents)::bigint from public.appointments a join public.services s on s.id=a.service_id where s.salon_id=p_salon and a.starts_at>=p_from and a.starts_at<p_to group by a.status order by a.status;
end $$;
revoke execute on function public.admin_report(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_report(uuid,timestamptz,timestamptz) to authenticated;
alter table public.booking_policies add column revision integer not null default 1;
alter table public.booking_policies add constraint policy_dashboard_bounds check(minimum_notice_minutes<=10080 and cancellation_notice_hours<=8760 and length(cancellation_text)<=3000 and deposit_value<=1000000);
create trigger policy_revision before update on public.booking_policies for each row execute function public.dashboard_revision();
alter table public.notification_jobs add column generation integer not null default 1;
-- Generation changes prevent a provider from deduplicating a reschedule as an earlier confirmation.
create or replace function salon_private.sync_appointment_notifications() returns trigger language plpgsql security definer set search_path='' as $$ declare payload jsonb;begin
 if new.status<>'confirmed' then update public.notification_jobs set sent_at=coalesce(sent_at,now()),locked_until=null,generation=generation+1 where appointment_id=new.id and sent_at is null;return null;end if;
 if new.email is null then return null;end if;
 if (tg_op='INSERT' and new.source<>'online') or (tg_op='UPDATE' and new.starts_at<>old.starts_at) then
 payload=jsonb_build_object('email',new.email,'name',new.client_name,'starts_at',new.starts_at,'reference',new.id);
 insert into public.notification_jobs(appointment_id,kind,payload,due_at) values(new.id,'confirmation',payload,now()),(new.id,'reminder',payload,greatest(now(),new.starts_at-interval '24 hours')) on conflict(appointment_id,kind) do update set payload=excluded.payload,due_at=excluded.due_at,sent_at=null,attempts=0,locked_until=null,generation=public.notification_jobs.generation+1;
 end if;return null;end $$;

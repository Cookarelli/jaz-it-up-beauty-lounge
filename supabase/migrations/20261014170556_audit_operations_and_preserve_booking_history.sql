-- Backfill existing bookings without changing their historical prices or occupied times.
insert into public.customers(salon_id,name,email,phone)
select distinct on(l.salon_id,lower(a.email)) l.salon_id,a.client_name,lower(a.email),a.phone from public.appointments a join public.stylists st on st.id=a.stylist_id join public.locations l on l.id=st.location_id order by l.salon_id,lower(a.email),a.created_at desc on conflict(salon_id,email) do nothing;
update public.appointments a set customer_id=c.id from public.stylists st join public.locations l on l.id=st.location_id join public.customers c on c.salon_id=l.salon_id where st.id=a.stylist_id and c.email=lower(a.email) and a.customer_id is null;
update public.appointments a set service_snapshot=jsonb_build_object('name',s.name,'price_cents',a.price_cents,'pricing_type',a.pricing_type,'duration_minutes',extract(epoch from a.ends_at-a.starts_at)/60,'includes_cut_style',s.includes_cut_style) from public.services s where s.id=a.service_id and a.service_snapshot='{}'::jsonb;
-- Minimal audit metadata only: never copy client name, email, phone, or notification payloads.
create function salon_private.audit_operations() returns trigger language plpgsql security definer set search_path='' as $$ declare record_json jsonb; salon uuid; entity uuid; begin
 record_json=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 entity=coalesce((record_json->>'id')::uuid,(record_json->>'salon_id')::uuid);
 if tg_table_name='appointments' then select salon_id into salon from public.services where id=(record_json->>'service_id')::uuid;
 elsif tg_table_name='availability' then select l.salon_id into salon from public.stylists st join public.locations l on l.id=st.location_id where st.id=(record_json->>'stylist_id')::uuid;
 else salon=(record_json->>'salon_id')::uuid; end if;
 insert into public.audit_logs(salon_id,actor_id,entity_type,entity_id,action) values(salon,auth.uid(),tg_table_name,entity,tg_op);
 return null;end $$;
revoke execute on function salon_private.audit_operations() from public,anon,authenticated;
create trigger audit_appointments after insert or update or delete on public.appointments for each row execute function salon_private.audit_operations();
create trigger audit_availability after insert or update or delete on public.availability for each row execute function salon_private.audit_operations();
create trigger audit_hours after insert or update or delete on public.business_hours for each row execute function salon_private.audit_operations();
create trigger audit_exceptions after insert or update or delete on public.schedule_exceptions for each row execute function salon_private.audit_operations();
create trigger audit_booking_policy after update on public.booking_policies for each row execute function salon_private.audit_operations();
-- Validate length qualifications and protect structured pricing metadata.
alter table public.services add constraint service_length check(length_qualification in ('any','above_shoulder','shoulder','below_shoulder','up_to_shoulder'));
alter table public.service_variants add constraint variant_length check(length_qualification in ('any','above_shoulder','shoulder','below_shoulder','up_to_shoulder'));

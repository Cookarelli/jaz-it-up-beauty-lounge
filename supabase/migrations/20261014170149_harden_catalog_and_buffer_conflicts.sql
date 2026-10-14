create or replace function public.validate_catalog_update() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if tg_op='UPDATE' then
 if new.salon_id<>old.salon_id or new.id<>old.id or new.slug<>old.slug then raise exception 'Catalog identity cannot be changed'; end if;
 if tg_table_name='service_variants' then if new.service_id<>old.service_id then raise exception 'Variant parent cannot be changed'; end if; end if;
 new.revision=old.revision+1;
 end if;
 if tg_table_name='service_variants' then
 if not exists(select 1 from public.services where id=new.service_id and salon_id=new.salon_id and category=new.category and includes_cut_style=new.includes_cut_style) then raise exception 'Variant must belong to matching salon, category and chemical bundle'; end if;
 end if;
 return new; end $$;
alter table public.services add constraint service_bundle check((category not in ('COLOR','PERMS') and slug<>'brazilian-blowout') or includes_cut_style);
alter table public.service_variants add constraint variant_bundle check(category not in ('COLOR','PERMS') or includes_cut_style);
alter table public.services add constraint service_text_bounds check(length(trim(name)) between 2 and 100 and length(description)<=500 and length(admin_notes)<=2000);
alter table public.service_variants add constraint variant_text_bounds check(length(trim(name)) between 2 and 100 and length(description)<=500 and length(admin_notes)<=2000);
alter table public.services add constraint service_price_bounds check(price_cents<=1000000 and price_max_cents<=1000000);
alter table public.service_variants add constraint variant_price_bounds check(price_cents<=1000000 and price_max_cents<=1000000);
-- Enforce buffered conflicts even for authenticated staff writes outside the booking RPC.
create function public.protect_appointment_schedule() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.status='cancelled' then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.stylist_id::text,1));
 if exists(select 1 from public.appointments a where a.id<>new.id and a.stylist_id=new.stylist_id and a.status<>'cancelled' and tstzrange(a.starts_at-make_interval(mins=>a.preparation_minutes),a.ends_at+make_interval(mins=>a.cleanup_minutes),'[)') && tstzrange(new.starts_at-make_interval(mins=>new.preparation_minutes),new.ends_at+make_interval(mins=>new.cleanup_minutes),'[)')) then raise exception 'Buffered appointment conflict'; end if;
 if new.variant_id is not null and not exists(select 1 from public.service_variants where id=new.variant_id and service_id=new.service_id) then raise exception 'Variant does not match service'; end if;
 if new.customer_id is not null and not exists(select 1 from public.customers c join public.services s on s.salon_id=c.salon_id where c.id=new.customer_id and s.id=new.service_id) then raise exception 'Customer does not match salon'; end if;
 return new; end $$;
create trigger protect_appointment_schedule before insert or update on public.appointments for each row execute function public.protect_appointment_schedule();

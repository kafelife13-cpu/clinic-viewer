-- Reuse the existing server-side teacher PIN. Preserve all roster versions.
begin;
revoke all on function public.read_weekend_roster(date) from public,anon,authenticated;
create or replace function public.read_weekend_roster(p_date date,p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved_hash text; result jsonb;
begin
 select pin_hash into saved_hash from private.clinic_teacher_settings where singleton=true;
 if saved_hash is null or p_pin is null or extensions.crypt(p_pin,saved_hash) is distinct from saved_hash then
  raise exception 'invalid teacher pin' using errcode='28000';
 end if;
 select public.read_weekend_roster(p_date) into result;
 return result;
end; $$;
revoke all on function public.read_weekend_roster(date,text) from public;
grant execute on function public.read_weekend_roster(date,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;

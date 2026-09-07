-- Date-specific Macgai rosters. Run in clinic-attendance as postgres.
-- No changes to users, their home classes, or attendance records.
begin;
create schema if not exists private;
create table if not exists private.weekend_rosters (
 id bigint generated always as identity primary key,
 lesson_date date not null check (extract(dow from lesson_date) in (0,6)),
 source_checked_at timestamptz not null,
 saved_at timestamptz not null default now(),
 classes jsonb not null check(jsonb_typeof(classes)='array'),
 unique(lesson_date,source_checked_at)
);
alter table private.weekend_rosters enable row level security;
revoke all on private.weekend_rosters from public,anon,authenticated;

create or replace function private.import_weekend_roster(p_date date,p_checked_at timestamptz,p_classes jsonb)
returns bigint language plpgsql set search_path=pg_catalog,private as $$
declare c jsonb; s jsonb; required text[]; actual text[]; result bigint; previous private.weekend_rosters;
begin
 if p_date is null or extract(dow from p_date) not in (0,6) or p_date < (now() at time zone 'Asia/Seoul')::date then raise exception 'invalid or past lesson date'; end if;
 if p_checked_at is null or p_checked_at>now()+interval '5 minutes' or p_checked_at<now()-interval '1 day' then raise exception 'source snapshot expired'; end if;
 if jsonb_typeof(p_classes) is distinct from 'array' then raise exception 'classes must be an array'; end if;
 required:=case when extract(dow from p_date)=6 then array['chidong_sat_1800','hanbaek_sat_1030','hanbaek_sat_1430'] else array['chidong_sun_1430','hanbaek_sun_1030'] end;
 select array_agg(x->>'class_id' order by x->>'class_id') into actual from jsonb_array_elements(p_classes) x;
 if actual is distinct from required then raise exception 'incomplete or duplicate classes'; end if;
 for c in select * from jsonb_array_elements(p_classes) loop
  if jsonb_typeof(c->'student_ids') is distinct from 'array' or jsonb_typeof(c->'expected_count') is distinct from 'number' then raise exception 'invalid class data'; end if;
  if jsonb_array_length(c->'student_ids') <> (c->>'expected_count')::integer or (c->>'expected_count')::integer not between 0 and 300 then raise exception 'student count mismatch'; end if;
  if jsonb_array_length(c->'student_ids') <> (select count(distinct value) from jsonb_array_elements(c->'student_ids')) then raise exception 'duplicate student'; end if;
  for s in select * from jsonb_array_elements(c->'student_ids') loop
   if jsonb_typeof(s)<>'string' or length(s#>>'{}') not between 1 and 100 then raise exception 'invalid student id'; end if;
  end loop;
 end loop;
 perform pg_advisory_xact_lock(836421,p_date-date '2000-01-01');
 select * into previous from private.weekend_rosters where lesson_date=p_date order by id desc limit 1;
 if previous.source_checked_at>p_checked_at then raise exception 'newer roster already saved'; end if;
 if previous.classes=p_classes then return previous.id; end if;
 insert into private.weekend_rosters(lesson_date,source_checked_at,classes) values(p_date,p_checked_at,p_classes) returning id into result;
 return result;
end; $$;
revoke all on function private.import_weekend_roster(date,timestamptz,jsonb) from public,anon,authenticated;

-- Same kiosk audience as existing class assignments; IDs only, no names or contacts.
create or replace function public.read_weekend_roster(p_date date)
returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select coalesce((select jsonb_build_object('date',lesson_date,'version',id,'source_checked_at',source_checked_at,'classes',classes)
 from private.weekend_rosters where lesson_date=p_date order by id desc limit 1),jsonb_build_object('date',p_date,'version',null,'classes','[]'::jsonb));
$$;
revoke all on function public.read_weekend_roster(date) from public;
grant execute on function public.read_weekend_roster(date) to anon,authenticated;
notify pgrst,'reload schema';
commit;

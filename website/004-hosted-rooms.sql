-- Hosted room state; accessible only by the Vercel server's service-role key.
begin;
create table public.together_rooms (
 code text primary key, invite text unique not null, version integer not null default 1,
 data jsonb not null, expires_at timestamptz not null
);
create index together_room_expiry on public.together_rooms(expires_at);
alter table public.together_rooms enable row level security;
revoke all on public.together_rooms from public, anon, authenticated;
grant select on public.together_rooms to service_role;
create table public.together_room_limits (key text primary key, count integer not null, until_at timestamptz not null);
alter table public.together_room_limits enable row level security;
revoke all on public.together_room_limits from public, anon, authenticated;

create function public.together_room_limit(bucket text, maximum integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare hits integer;
begin
 delete from public.together_room_limits where until_at < now();
 insert into public.together_room_limits(key,count,until_at) values(bucket,1,now()+interval '1 minute')
 on conflict(key) do update set count = public.together_room_limits.count + 1 returning count into hits;
 return hits <= maximum;
end; $$;

-- Compare-and-swap prevents readiness, joins and signal messages overwriting each other.
create function public.together_save_room(room_code text, expected_version integer, room_data jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
 if expected_version = 0 then
   perform pg_advisory_xact_lock(704002);
   delete from public.together_rooms where expires_at < now();
   if (select count(*) from public.together_rooms) >= 500 then raise exception 'Rooms at capacity'; end if;
   insert into public.together_rooms(code,invite,data,expires_at)
   values(room_code,room_data->>'invite',room_data,to_timestamp((room_data->>'expires')::double precision/1000))
   on conflict do nothing;
 elsif room_data is null then
   delete from public.together_rooms where code = room_code and version = expected_version;
 else
   update public.together_rooms set data = room_data, version = version + 1
   where code = room_code and version = expected_version;
 end if;
 get diagnostics affected = row_count;
 return affected = 1;
end; $$;
revoke all on function public.together_room_limit(text,integer), public.together_save_room(text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.together_room_limit(text,integer), public.together_save_room(text,integer,jsonb) to service_role;
commit;

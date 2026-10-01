-- Run after migrations 001-007. No photos or receipts enter Realtime.
begin;
create index if not exists together_room_signal_topic
  on public.together_rooms ((data->>'signalTopic'));

create or replace function public.together_can_signal(topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.together_rooms r
    where r.data->>'signalTopic' = topic
      and r.expires_at > now()
      and r.data->'settings'->>'source' = 'camera'
      and r.data->'host'->>'ready' = 'true'
      and r.data->'guest'->>'ready' = 'true'
      and auth.uid()::text in (r.data->'host'->>'userId', r.data->'guest'->>'userId')
      and public.together_room_has_ticket(r.invite, (r.data->'host'->>'userId')::uuid)
  );
$$;
revoke all on function public.together_can_signal(text) from public, anon;
grant execute on function public.together_can_signal(text) to authenticated;

drop policy if exists together_camera_receive on realtime.messages;
create policy together_camera_receive on realtime.messages for select to authenticated
  using (extension = 'broadcast' and public.together_can_signal((select realtime.topic())));
drop policy if exists together_camera_send on realtime.messages;
create policy together_camera_send on realtime.messages for insert to authenticated
  with check (extension = 'broadcast' and public.together_can_signal((select realtime.topic())));
commit;

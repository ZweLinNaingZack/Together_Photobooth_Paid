-- Read-only: run in Supabase SQL Editor while both users are in a NEW,
-- ready camera room. This contains no room tokens or participant identities.
-- No rows in the second result means there are no unexpired camera rooms.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='realtime' and tablename='messages'
  and policyname in ('together_camera_receive','together_camera_send');

select
  right(data->>'signalTopic',8) as topic_suffix,
  expires_at > now() as room_unexpired,
  data->'host'->>'ready' = 'true' as host_ready,
  data->'guest'->>'ready' = 'true' as guest_ready,
  data->'host'->>'userId' is not null as host_identity_present,
  data->'guest'->>'userId' is not null as guest_identity_present,
  public.together_room_has_ticket(invite,(data->'host'->>'userId')::uuid) as creator_authorized
from public.together_rooms
where expires_at > now() and data->'settings'->>'source'='camera';

select pg_get_functiondef(to_regprocedure('public.together_can_signal(text)')) as deployed_authorization_rule;

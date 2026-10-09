-- 019: Let a signed-in user find their OWN unfinished booth reservation.
-- Run after 018 in the Supabase SQL editor.
--
-- Why: a reservation is created when the user picks a layout (45-minute hold).
-- If the page is refreshed during "Your photos", the browser can lose the
-- reservation id. The server then blocks a new booth ("You already have an
-- active booth") and the app had no way to find the old one again.
--
-- This function is READ-ONLY: it never reserves, charges, or releases anything.
-- Releasing still goes through together_session_action(id, 'release').
begin;

create or replace function public.together_active_session()
returns jsonb
language sql
stable
security definer          -- reservations table is not readable by clients directly (RLS + revoke)
set search_path = ''      -- prevents search_path hijacking inside a security definer function
as $$
  select jsonb_build_object(
    'session_id', r.id,
    'used_trial', r.used_trial,
    'duo',        r.room_reference is not null,   -- duo booths have a room invitation reference
    'expires_at', r.expires_at,
    'created_at', r.created_at
  )
  from public.together_reservations r
  where r.user_id = auth.uid()                    -- only the caller's own reservation
    and r.status = 'reserved'
    and r.expires_at > now()
    and not exists (select 1 from public.together_sessions s where s.id = r.id)  -- not already paid
  order by r.created_at desc
  limit 1;
$$;

revoke all on function public.together_active_session() from public, anon;
grant execute on function public.together_active_session() to authenticated;

commit;

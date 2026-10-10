-- 020: make togetherphotobooth.xyz@gmail.com an administrator.
--
-- BEFORE running: sign up on the website with togetherphotobooth.xyz@gmail.com
-- (Google or email + password) and confirm the email. This needs an existing, confirmed account.
--
-- Admin access is tied to the account's user ID, not to an email typed anywhere,
-- so someone who only knows the address cannot become admin.
--
-- Gmail ignores dots and anything after "+", so the account is matched by its real mailbox
-- (togetherphotoboothxyz@gmail.com). That way it works however the address was typed.
do $$
declare new_admin uuid;
begin
  select id into new_admin from auth.users
  where split_part(lower(email), '@', 2) in ('gmail.com', 'googlemail.com')
    and replace(split_part(split_part(lower(email), '@', 1), '+', 1), '.', '') = 'togetherphotoboothxyz'
    and email_confirmed_at is not null
  order by created_at
  limit 1;

  if new_admin is null then
    raise exception 'No confirmed account for togetherphotobooth.xyz@gmail.com yet. Sign up on the website and confirm the email first.';
  end if;

  -- "on conflict do nothing" makes it safe to run twice.
  insert into public.together_admins(user_id) values (new_admin) on conflict do nothing;
end;
$$;

-- Check: should list both admins (the old one stays until you remove it).
select u.email, a.created_at from public.together_admins a join auth.users u on u.id = a.user_id;

-- ---------------------------------------------------------------------------
-- LATER, only after you have signed in with the new email and the
-- "Admin reviews" tab works: remove the old admin by running this line on its own.
--
-- delete from public.together_admins where user_id = (select id from auth.users where lower(email) = 'zwelinnaing34@gmail.com');
-- ---------------------------------------------------------------------------

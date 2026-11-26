-- "Only me": the app is single-owner. Once the owner account exists, refuse any further sign-ups at the
-- database level (backs up the Supabase Auth "Allow new users to sign up" switch, now that the site is public).
create or replace function public.block_extra_signups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Sign-ups are closed for this workspace.' using errcode = 'P0001';
  end if;
  return new;
end
$$;

revoke all on function public.block_extra_signups() from public, anon, authenticated;

drop trigger if exists block_extra_signups on auth.users;
create trigger block_extra_signups
  before insert on auth.users
  for each row execute function public.block_extra_signups();

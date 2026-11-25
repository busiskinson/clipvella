-- A media_assets row may only point at its owner's own storage folder, and its location/owner are immutable.
-- The worker reads these rows with the service role, so this is what stops a user from pointing a row at
-- someone else's file and getting the worker to copy it.
create or replace function public.enforce_asset_owner_path() returns trigger
language plpgsql set search_path = '' as $$
begin
  if split_part(new.path, '/', 1) <> new.owner_id::text then
    raise exception 'media path must start with the owner''s id' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and (new.owner_id <> old.owner_id or new.bucket <> old.bucket or new.path <> old.path) then
    raise exception 'media owner, bucket and path cannot be changed' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger media_assets_owner_path
  before insert or update on public.media_assets
  for each row execute function public.enforce_asset_owner_path();

revoke all on function public.enforce_asset_owner_path() from public, anon, authenticated;

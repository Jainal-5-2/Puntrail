create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'visitor');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.normalize_burial_name()
returns trigger
language plpgsql
as $$
begin
  new.name_normalized := lower(
    regexp_replace(
      extensions.unaccent(coalesce(new.full_name, '')),
      '\s+', ' ', 'g'
    )
  );
  return new;
end;
$$;

create trigger burials_normalize_name
  before insert or update of full_name on public.burials
  for each row execute function public.normalize_burial_name();
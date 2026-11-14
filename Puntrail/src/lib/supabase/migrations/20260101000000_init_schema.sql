create extension if not exists postgis;

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'visitor' check (role in ('visitor', 'admin')),
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: self read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table public.cemeteries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  location   text not null,
  boundary   geometry(Polygon, 4326),
  notes      text,
  version    integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cemeteries_boundary_gist on public.cemeteries using gist (boundary);

alter table public.cemeteries enable row level security;

create policy "cemeteries: public read"
  on public.cemeteries for select
  using (true);

create policy "cemeteries: admin write"
  on public.cemeteries for all
  using (public.is_admin())
  with check (public.is_admin());

create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  cemetery_id uuid not null references public.cemeteries(id) on delete cascade,
  name        text not null,
  boundary    geometry(Polygon, 4326),
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index sections_cemetery on public.sections(cemetery_id);
create index sections_boundary_gist on public.sections using gist (boundary);

alter table public.sections enable row level security;

create policy "sections: public read"
  on public.sections for select
  using (true);

create policy "sections: admin write"
  on public.sections for all
  using (public.is_admin())
  with check (public.is_admin());

create table public.plots (
  id                uuid primary key default gen_random_uuid(),
  cemetery_id       uuid not null references public.cemeteries(id) on delete cascade,
  section_id        uuid references public.sections(id) on delete set null,
  plot_identifier   text not null,
  geometry          geometry(Geometry, 4326) not null
                    check (GeometryType(geometry) in ('POLYGON', 'MULTIPOLYGON')),
  geometry_source   text not null
                    check (geometry_source in ('survey', 'official_plan', 'imagery', 'estimated')),
  geometry_verified boolean not null default false,
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (cemetery_id, plot_identifier)
);

create index plots_cemetery on public.plots(cemetery_id);
create index plots_section on public.plots(section_id);
create index plots_geometry_gist on public.plots using gist (geometry);

alter table public.plots enable row level security;

create policy "plots: public read"
  on public.plots for select
  using (true);

create policy "plots: admin write"
  on public.plots for all
  using (public.is_admin())
  with check (public.is_admin());

create table public.burials (
  id              uuid primary key default gen_random_uuid(),
  plot_id         uuid not null references public.plots(id) on delete cascade,
  full_name       text not null,
  name_normalized text,
  date_of_death   date,
  date_of_burial  date,
  age_at_death    text,
  notes           text,
  status          text not null default 'pending'
                  check (status in ('verified', 'pending', 'rejected')),
  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index burials_plot on public.burials(plot_id);
create index burials_status on public.burials(status);
create index burials_name_normalized on public.burials(name_normalized);

alter table public.burials enable row level security;

create policy "burials: read verified"
  on public.burials for select
  using (status = 'verified' or public.is_admin());

create policy "burials: admin write"
  on public.burials for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.bump_version()
returns trigger
language plpgsql
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger cemeteries_bump_version before update on public.cemeteries
  for each row execute function public.bump_version();
create trigger sections_bump_version before update on public.sections
  for each row execute function public.bump_version();
create trigger plots_bump_version before update on public.plots
  for each row execute function public.bump_version();
create trigger burials_bump_version before update on public.burials
  for each row execute function public.bump_version();

-- Removed `set search_path = ''` so Postgres can find ST_AsGeoJSON wherever PostGIS was installed.
create or replace function public.get_plots_as_geojson()
returns table (
  id                uuid,
  cemetery_id       uuid,
  section_id        uuid,
  plot_identifier   text,
  geom_geojson      text,
  geometry_source   text,
  geometry_verified boolean,
  version           integer,
  created_at        timestamptz,
  updated_at        timestamptz
)
language sql
stable
security definer
as $$
  select
    p.id,
    p.cemetery_id,
    p.section_id,
    p.plot_identifier,
    st_asgeojson(p.geometry, 9) as geom_geojson,
    p.geometry_source,
    p.geometry_verified,
    p.version,
    p.created_at,
    p.updated_at
  from public.plots p
  order by p.cemetery_id, p.plot_identifier;
$$;

grant execute on function public.get_plots_as_geojson() to anon, authenticated;
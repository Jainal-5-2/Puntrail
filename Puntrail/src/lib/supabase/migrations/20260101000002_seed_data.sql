-- 1. Insert a test cemetery (Isabela City, Basilan approx coordinates)
insert into public.cemeteries (id, name, location, boundary)
values (
  '11111111-1111-1111-1111-111111111111',
  'Isabela City Public Cemetery',
  'Isabela City, Basilan',
  null
);

-- 2. Insert a section
insert into public.sections (id, cemetery_id, name, boundary)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Section A',
  null
);

-- 3. Insert a test plot with a small polygon (approx 5x5 meters)
-- Coordinates are near Isabela City (121.9711, 6.7054)
insert into public.plots (
  id, 
  cemetery_id, 
  section_id, 
  plot_identifier, 
  geometry, 
  geometry_source, 
  geometry_verified
)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'A-001',
  ST_GeomFromText('POLYGON((121.9711 6.7054, 121.9712 6.7054, 121.9712 6.7055, 121.9711 6.7055, 121.9711 6.7054))', 4326),
  'survey',
  true
);

-- 4. Insert a verified burial record linked to the plot
insert into public.burials (
  id, 
  plot_id, 
  full_name, 
  date_of_burial, 
  status
)
values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'Juan Dela Cruz',
  '2023-01-15',
  'verified'
);
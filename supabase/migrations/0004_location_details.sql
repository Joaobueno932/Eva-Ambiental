-- =============================================================
-- Eva Ambiental — Detalhes de localização (reverse geocoding)
-- =============================================================
-- Adiciona campos de endereço (resultado do reverse geocode) em
-- weighings e weighing_photos. Mantém compatibilidade com os campos
-- antigos: gps_lat, gps_lng, manual_location.
-- =============================================================

-- ---------------- weighings ----------------
alter table public.weighings
  add column if not exists location_place_name text,
  add column if not exists location_street text,
  add column if not exists location_number text,
  add column if not exists location_neighborhood text,
  add column if not exists location_postal_code text,
  add column if not exists location_city text,
  add column if not exists location_state text,
  add column if not exists location_country text,
  add column if not exists location_formatted_address text;

-- ---------------- weighing_photos ----------------
alter table public.weighing_photos
  add column if not exists location_place_name text,
  add column if not exists location_street text,
  add column if not exists location_number text,
  add column if not exists location_neighborhood text,
  add column if not exists location_postal_code text,
  add column if not exists location_city text,
  add column if not exists location_state text,
  add column if not exists location_country text,
  add column if not exists location_formatted_address text;

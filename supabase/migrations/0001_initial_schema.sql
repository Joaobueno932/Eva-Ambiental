-- =============================================================
-- Eva Ambiental — Esquema inicial do banco de dados
-- =============================================================
-- Cria tabelas, índices, funções auxiliares, triggers e RLS.
-- Execute via Supabase SQL Editor ou `supabase db push`.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 1. profiles
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin','analyst','viewer')),
  active boolean not null default true,
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 2. clients
-- -------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 3. units
-- -------------------------------------------------------------
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  city text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 4. waste_types
-- -------------------------------------------------------------
create table if not exists public.waste_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 5. treatment_types
-- -------------------------------------------------------------
create table if not exists public.treatment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  counts_as_diversion boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 6. recipients
-- -------------------------------------------------------------
create table if not exists public.recipients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 7. weighings
-- -------------------------------------------------------------
create table if not exists public.weighings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  unit_id uuid references public.units(id),
  waste_type_id uuid references public.waste_types(id),
  treatment_type_id uuid references public.treatment_types(id),
  recipient_id uuid references public.recipients(id),
  weighing_date timestamptz not null default now(),
  weight_kg numeric(10,2) not null check (weight_kg >= 0),
  status text not null default 'completed',
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  gps_lat numeric,
  gps_lng numeric,
  manual_location text,
  image_source text check (image_source in ('camera','upload')),
  captured_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 8. weighing_photos
-- -------------------------------------------------------------
create table if not exists public.weighing_photos (
  id uuid primary key default gen_random_uuid(),
  weighing_id uuid not null references public.weighings(id) on delete cascade,
  storage_path text not null,
  public_url text,
  image_source text check (image_source in ('camera','upload')),
  gps_lat numeric,
  gps_lng numeric,
  manual_location text,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 9. audit_logs
-- -------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Índices
-- -------------------------------------------------------------
create index if not exists idx_units_client on public.units(client_id);
create index if not exists idx_weighings_client on public.weighings(client_id);
create index if not exists idx_weighings_unit on public.weighings(unit_id);
create index if not exists idx_weighings_waste on public.weighings(waste_type_id);
create index if not exists idx_weighings_status on public.weighings(approval_status);
create index if not exists idx_weighings_date on public.weighings(weighing_date);
create index if not exists idx_weighings_creator on public.weighings(created_by);
create index if not exists idx_photos_weighing on public.weighing_photos(weighing_id);
create index if not exists idx_profiles_client on public.profiles(client_id);

-- -------------------------------------------------------------
-- Funções auxiliares (SECURITY DEFINER evita recursão de RLS)
-- -------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select active and role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Pode ler dados (qualquer perfil ativo)
create or replace function public.can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active();
$$;

-- Pode criar/editar pesagens (admin ou analyst, ativos)
create or replace function public.can_write_weighings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select active and role in ('admin','analyst') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- -------------------------------------------------------------
-- Triggers: updated_at automático
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_weighings_updated on public.weighings;
create trigger trg_weighings_updated before update on public.weighings
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- Trigger: cria profile automaticamente ao criar usuário no Auth
-- Lê metadados (full_name, role) definidos pela Edge Function.
-- -------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, active, client_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'viewer'),
    coalesce((new.raw_user_meta_data->>'active')::boolean, true),
    (new.raw_user_meta_data->>'client_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
alter table public.profiles        enable row level security;
alter table public.clients         enable row level security;
alter table public.units           enable row level security;
alter table public.waste_types     enable row level security;
alter table public.treatment_types enable row level security;
alter table public.recipients      enable row level security;
alter table public.weighings       enable row level security;
alter table public.weighing_photos enable row level security;
alter table public.audit_logs      enable row level security;

-- ---------------- profiles ----------------
-- Cada usuário lê o próprio perfil; admin lê todos.
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Usuário pode atualizar o próprio nome (não o role/active); admin atualiza tudo.
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- cadastros mestres (clients, units, waste_types, treatment_types, recipients) ----------------
-- Leitura: qualquer usuário ativo. Escrita: somente admin.
create policy clients_read on public.clients
  for select using (public.can_read());
create policy clients_admin on public.clients
  for all using (public.is_admin()) with check (public.is_admin());

create policy units_read on public.units
  for select using (public.can_read());
create policy units_admin on public.units
  for all using (public.is_admin()) with check (public.is_admin());

create policy waste_types_read on public.waste_types
  for select using (public.can_read());
create policy waste_types_admin on public.waste_types
  for all using (public.is_admin()) with check (public.is_admin());

create policy treatment_types_read on public.treatment_types
  for select using (public.can_read());
create policy treatment_types_admin on public.treatment_types
  for all using (public.is_admin()) with check (public.is_admin());

create policy recipients_read on public.recipients
  for select using (public.can_read());
create policy recipients_admin on public.recipients
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- weighings ----------------
-- Leitura: qualquer usuário ativo.
create policy weighings_read on public.weighings
  for select using (public.can_read());

-- Inserção: admin/analyst ativos. Garante que created_by é o próprio usuário e status inicial pendente.
create policy weighings_insert on public.weighings
  for insert with check (
    public.can_write_weighings()
    and created_by = auth.uid()
    and approval_status = 'pending'
  );

-- Atualização (analyst): apenas registros próprios e pendentes; não pode aprovar/rejeitar.
create policy weighings_update_owner on public.weighings
  for update using (
    public.can_write_weighings()
    and created_by = auth.uid()
    and approval_status = 'pending'
  )
  with check (
    created_by = auth.uid()
    and approval_status = 'pending'
  );

-- Atualização (admin): qualquer pesagem, inclusive aprovação/rejeição.
create policy weighings_update_admin on public.weighings
  for update using (public.is_admin()) with check (public.is_admin());

-- Exclusão: somente admin.
create policy weighings_delete_admin on public.weighings
  for delete using (public.is_admin());

-- ---------------- weighing_photos ----------------
create policy photos_read on public.weighing_photos
  for select using (public.can_read());

-- Insere foto se puder escrever pesagens e a pesagem for dele (ou se admin).
create policy photos_insert on public.weighing_photos
  for insert with check (
    public.can_write_weighings()
    and exists (
      select 1 from public.weighings w
      where w.id = weighing_id
        and (public.is_admin() or w.created_by = auth.uid())
    )
  );

create policy photos_delete on public.weighing_photos
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.weighings w
      where w.id = weighing_id
        and w.created_by = auth.uid()
        and w.approval_status = 'pending'
    )
  );

-- ---------------- audit_logs ----------------
create policy audit_read_admin on public.audit_logs
  for select using (public.is_admin());
create policy audit_insert on public.audit_logs
  for insert with check (public.is_active() and user_id = auth.uid());

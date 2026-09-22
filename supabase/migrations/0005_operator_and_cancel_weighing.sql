-- =============================================================
-- Eva Ambiental — Perfil Operador + Cancelamento de Pesagens
-- =============================================================
-- 1. Adiciona 'operator' à constraint de role em profiles
-- 2. Adiciona colunas de cancelamento em weighings
-- 3. Atualiza can_write_weighings() para incluir operator
-- 4. Adiciona função is_analyst_or_admin() para cancelamento/aprovação
-- 5. Adiciona policy para analista atualizar pesagens (aprovar/rejeitar/cancelar)
-- Execute via Supabase SQL Editor ou `supabase db push`.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Atualizar constraint do role em profiles para aceitar 'operator'
-- -------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin','analyst','operator','viewer'));

-- -------------------------------------------------------------
-- 2. Adicionar colunas de cancelamento em weighings
-- -------------------------------------------------------------
alter table public.weighings
  add column if not exists canceled_at timestamptz,
  add column if not exists canceled_by uuid references public.profiles(id),
  add column if not exists cancellation_reason text;

create index if not exists idx_weighings_canceled on public.weighings(canceled_at)
  where canceled_at is not null;

-- -------------------------------------------------------------
-- 3. Atualizar can_write_weighings para incluir operator
--    (inserção e edição de próprias pesagens pendentes)
-- -------------------------------------------------------------
create or replace function public.can_write_weighings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select active and role in ('admin','analyst','operator')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- -------------------------------------------------------------
-- 4. Nova função is_analyst_or_admin (aprovação / cancelamento)
-- -------------------------------------------------------------
create or replace function public.is_analyst_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select active and role in ('admin','analyst')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- -------------------------------------------------------------
-- 5. Policy: analista pode atualizar qualquer pesagem
--    (aprovar, rejeitar, cancelar — restrições finas na aplicação)
-- -------------------------------------------------------------
drop policy if exists weighings_update_analyst on public.weighings;
create policy weighings_update_analyst on public.weighings
  for update
  using  (public.is_analyst_or_admin())
  with check (public.is_analyst_or_admin());

-- Garante que os GRANTs também cubram os novos objetos
grant execute on function public.is_analyst_or_admin() to authenticated;

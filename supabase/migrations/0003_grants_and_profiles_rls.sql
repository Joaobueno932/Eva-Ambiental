-- =============================================================
-- Eva Ambiental — GRANTs de privilégio + refino das policies de profiles
-- =============================================================
-- CAUSA DO ERRO DE LOGIN: com RLS ativo, o papel `authenticated` ainda
-- precisa de GRANT de privilégio na tabela. Sem o GRANT, o Postgres
-- retorna 42501 ("permission denied") ANTES de avaliar as policies.
-- Esta migration concede os privilégios e o RLS continua filtrando linhas.
-- Rode no SQL Editor (ou via supabase db push).
-- =============================================================

-- O app exige login, então só o papel `authenticated` recebe acesso.
-- O `anon` (pré-login) permanece sem privilégios — nada é legível sem autenticar.
grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Objetos futuros herdam os mesmos privilégios.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- -------------------------------------------------------------
-- Policies de profiles (mínimas e claras)
-- -------------------------------------------------------------
-- - Usuário autenticado lê o PRÓPRIO perfil
-- - Admin ativo lê TODOS os perfis
-- - Admin ativo gerencia (insert/update/delete) os perfis
-- (is_admin() é SECURITY DEFINER, evita recursão de RLS)
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_admin_manage on public.profiles;

create policy profiles_select_self_or_admin on public.profiles
  for select
  using (id = auth.uid() or public.is_admin());

create policy profiles_admin_manage on public.profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

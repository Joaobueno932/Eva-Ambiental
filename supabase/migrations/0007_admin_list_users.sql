-- Lista de usuários com a data do último acesso.
--
-- A tela de Usuários mostra quando cada pessoa entrou pela última vez — é o
-- que permite notar uma conta esquecida ativa, ou alguém que nunca chegou a
-- entrar. Esse dado mora em `auth.users.last_sign_in_at`, que o cliente não
-- enxerga: o esquema `auth` é do Supabase e não é exposto pela API.
--
-- A função roda como o dono (`security definer`) para poder ler `auth.users`,
-- e por isso mesmo só responde a administradores ativos: para qualquer outro
-- perfil devolve zero linhas, e não um erro que confirmaria que ela existe.
--
-- Aditivo: nenhuma tabela muda. Sem esta migração o app continua listando os
-- usuários pela tabela `profiles`, só sem a coluna de acesso.

create or replace function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  active boolean,
  client_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.role, p.active, p.client_id,
         p.created_at, p.updated_at, u.last_sign_in_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.full_name;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

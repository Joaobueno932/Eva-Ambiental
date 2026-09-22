-- Observações sobre o usuário.
--
-- A tela de Usuários tem um campo livre no painel de detalhes ("Adicione uma
-- observação sobre este usuário") — onde se registra, por exemplo, que a conta
-- é de um estagiário com prazo, ou por que alguém foi desativado. Sem uma
-- coluna para isso, o texto não teria onde ficar.
--
-- Limite de 500 caracteres, o mesmo que a interface mostra no contador: é uma
-- anotação, não um histórico.
--
-- A função `admin_list_users` é recriada para devolver a coluna nova. A
-- interface só habilita o campo quando ela vem na resposta, então a ordem de
-- aplicação das migrações não trava a tela.

alter table public.profiles
  add column if not exists notes text;

alter table public.profiles
  drop constraint if exists profiles_notes_length;

alter table public.profiles
  add constraint profiles_notes_length check (notes is null or char_length(notes) <= 500);

create or replace function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  active boolean,
  client_id uuid,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.role, p.active, p.client_id, p.notes,
         p.created_at, p.updated_at, u.last_sign_in_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.full_name;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- CPF e data de nascimento do usuário.
--
-- Dois dados pessoais do cadastro interno: o CPF identifica a pessoa em
-- documentos e relatórios de conformidade, e a data de nascimento vem junto
-- porque é o par que um cadastro de pessoa costuma pedir.
--
-- O CPF é único entre os perfis: repetido, ele deixa de identificar. Contas
-- sem CPF continuam válidas — em índice único, vários nulos convivem.
--
-- Como em 0008, a função `admin_list_users` é recriada para devolver as
-- colunas novas: ela tem lista fixa de colunas, e sem recriá-la a tela
-- receberia os usuários sem CPF nenhum.

alter table public.profiles
  add column if not exists cpf text,
  add column if not exists birth_date date;

-- Só dígitos, e os onze do CPF. A interface grava sem pontuação; a máscara é
-- coisa de exibição, e gravar as duas formas faria o mesmo CPF existir duas
-- vezes no banco.
alter table public.profiles
  drop constraint if exists profiles_cpf_format;
alter table public.profiles
  add constraint profiles_cpf_format check (cpf is null or cpf ~ '^[0-9]{11}$');

-- Data de nascimento no futuro é erro de digitação, não uma data.
alter table public.profiles
  drop constraint if exists profiles_birth_date_past;
alter table public.profiles
  add constraint profiles_birth_date_past check (birth_date is null or birth_date < current_date);

create unique index if not exists idx_profiles_cpf on public.profiles(cpf) where cpf is not null;

create or replace function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  active boolean,
  client_id uuid,
  notes text,
  cpf text,
  birth_date date,
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
         p.cpf, p.birth_date,
         p.created_at, p.updated_at, u.last_sign_in_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.full_name;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

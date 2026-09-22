-- =============================================================
-- Eva Ambiental — migrações 0006 a 0015, na ordem, em um arquivo
-- =============================================================
-- Para aplicar: abra o SQL Editor do Supabase (painel do projeto),
-- cole este arquivo inteiro e execute. Também funciona pelo psql:
--
--     psql "$DATABASE_URL" -f supabase/aplicar_migracoes.sql
--
-- Rodar duas vezes não faz diferença: todos os comandos são
-- idempotentes (`add column if not exists`, `create or replace`,
-- `drop ... if exists`), então o que já existe é deixado como está.
--
-- Este arquivo é uma conveniência: a fonte continua sendo cada
-- migração numerada em supabase/migrations/. Gerado a partir delas.
--
-- Conteúdo, em ordem:
--   0006_weighing_sequence.sql
--   0007_admin_list_users.sql
--   0008_profile_notes.sql
--   0009_client_profile.sql
--   0010_unit_profile.sql
--   0011_treatment_profile.sql
--   0012_waste_type_profile.sql
--   0013_missing_columns.sql
--   0014_recipient_profile.sql
--   0015_profile_cpf_birth.sql
-- =============================================================


-- =============================================================
-- 0006_weighing_sequence.sql
-- =============================================================

-- Número sequencial das pesagens.
--
-- A chave primária é um UUID, que identifica o registro mas não serve para
-- uma pessoa citar: ninguém lê "pesagem a3f9c1d2" em voz alta numa conferência
-- de aterro. O painel e a listagem passam a exibir "000028", e para isso
-- precisam de um contador estável — que não muda quando um filtro é aplicado
-- nem quando um registro é cancelado.
--
-- Aditivo: a coluna é preenchida sozinha em novas inserções e o backfill
-- ordena os registros existentes por data de criação. Nenhuma coluna é
-- removida ou renomeada, então a versão anterior do app continua funcionando.

alter table public.weighings
  add column if not exists seq bigint;

-- Sequência própria em vez de `bigserial`: assim o backfill abaixo pode
-- posicionar o contador depois dos registros que já existem.
create sequence if not exists public.weighings_seq_seq owned by public.weighings.seq;

-- Backfill por ordem de criação: o número mais baixo é a pesagem mais antiga.
with ordered as (
  select id, row_number() over (order by created_at, id) as position
  from public.weighings
  where seq is null
)
update public.weighings w
set seq = ordered.position
from ordered
where w.id = ordered.id;

-- Posiciona a sequência após o maior número já atribuído.
select setval(
  'public.weighings_seq_seq',
  coalesce((select max(seq) from public.weighings), 0) + 1,
  false
);

alter table public.weighings
  alter column seq set default nextval('public.weighings_seq_seq');

alter table public.weighings
  alter column seq set not null;

-- Um número por pesagem, e busca rápida ao abrir um registro pelo código.
create unique index if not exists weighings_seq_key on public.weighings (seq);


-- =============================================================
-- 0007_admin_list_users.sql
-- =============================================================

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


-- =============================================================
-- 0008_profile_notes.sql
-- =============================================================

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


-- =============================================================
-- 0009_client_profile.sql
-- =============================================================

-- Cadastro completo de cliente.
--
-- A tela de Clientes pede um cadastro que a tabela não tinha: ela nasceu com
-- nome, documento, e-mail e telefone. O painel de detalhes tem razão social e
-- nome fantasia separados, inscrição estadual, segmento, responsável e cargo,
-- cidade/UF e observações — e a lista tem uma coluna de segmento, um filtro
-- por cidade e uma coluna de última atualização.
--
-- Cada coluna aqui corresponde a um campo da tela. Nenhuma é obrigatória: os
-- clientes que já existem continuam válidos com os campos vazios, e a tela
-- mostra "—" onde não há dado.
--
-- Enquanto esta migração não for aplicada, a interface detecta a ausência das
-- colunas na resposta e desabilita os campos correspondentes, em vez de
-- aceitar um texto que não teria onde ser gravado.

alter table public.clients
  add column if not exists trade_name text,
  add column if not exists state_registration text,
  add column if not exists segment text,
  add column if not exists contact_name text,
  add column if not exists contact_role text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

-- UF com duas letras: o campo da tela é uma sigla, não o nome do estado.
alter table public.clients
  drop constraint if exists clients_state_length;
alter table public.clients
  add constraint clients_state_length check (state is null or char_length(state) = 2);

-- Mesmo limite que o contador da tela mostra (0/500): é uma anotação sobre o
-- cliente, não um histórico.
alter table public.clients
  drop constraint if exists clients_notes_length;
alter table public.clients
  add constraint clients_notes_length check (notes is null or char_length(notes) <= 500);

-- A coluna "Última atualização" da lista precisa de quem a mantenha: sem o
-- gatilho, `updated_at` congelaria na data de criação e a coluna mentiria.
-- A função `public.set_updated_at()` vem da migração 0001.
drop trigger if exists trg_clients_updated on public.clients;
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();

-- O filtro por cidade e a ordenação por segmento varrem a tabela inteira;
-- com poucos clientes o índice é indiferente, mas ele não custa nada.
create index if not exists idx_clients_segment on public.clients(segment);
create index if not exists idx_clients_city on public.clients(city);


-- =============================================================
-- 0010_unit_profile.sql
-- =============================================================

-- Cadastro completo de unidade.
--
-- A tabela nasceu com cliente, nome, cidade e endereço em texto livre. A tela
-- de Unidades pede código, tipo de operação, responsável, telefone, estado,
-- observações e o detalhamento do endereço (CEP, logradouro, bairro).
--
-- Duas dessas colunas não são só do desenho: `street`, `neighborhood`,
-- `state` e `postal_code` já eram gravadas pelo formulário antigo de
-- unidades e pelo tipo `Unit` do aplicativo, mas nunca foram criadas — quem
-- salvava uma unidade recebia erro do banco. Esta migração conserta isso.
--
-- Enquanto ela não for aplicada, a tela detecta a ausência das colunas e
-- desabilita os campos correspondentes, em vez de aceitar um texto que não
-- teria onde ser gravado.

alter table public.units
  add column if not exists code text,
  add column if not exists type text,
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists street text,
  add column if not exists neighborhood text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

-- UF com duas letras: o campo da tela é uma sigla, não o nome do estado.
alter table public.units
  drop constraint if exists units_state_length;
alter table public.units
  add constraint units_state_length check (state is null or char_length(state) = 2);

-- Mesmo limite que o contador da tela mostra (0/500).
alter table public.units
  drop constraint if exists units_notes_length;
alter table public.units
  add constraint units_notes_length check (notes is null or char_length(notes) <= 500);

-- O código serve para identificar a unidade num documento ou numa planilha;
-- repetido, ele não identifica nada. Unidades sem código continuam válidas —
-- em índice único, vários nulos convivem.
create unique index if not exists idx_units_code on public.units(lower(code)) where code is not null;

-- A coluna "Última atualização" precisa de quem a mantenha: sem o gatilho,
-- `updated_at` congelaria na data de criação. A função vem da migração 0001.
drop trigger if exists trg_units_updated on public.units;
create trigger trg_units_updated before update on public.units
  for each row execute function public.set_updated_at();

create index if not exists idx_units_city on public.units(city);

-- -------------------------------------------------------------
-- Pesagens por unidade
-- -------------------------------------------------------------
-- A lista mostra a data da última pesagem de cada unidade e o indicador conta
-- quantas unidades receberam pesagem no mês. Sem esta agregação, a tela
-- precisaria baixar a tabela de pesagens inteira só para descobrir duas
-- datas por unidade.
--
-- Sem `security definer`: a função roda com as permissões de quem chama, e
-- portanto respeita as políticas de leitura de `weighings`. Pesagens
-- canceladas não contam — uma pesagem cancelada não é atividade da unidade.
create or replace function public.unit_weighing_stats()
returns table (
  unit_id uuid,
  last_weighing timestamptz,
  weighings_this_month bigint
)
language sql
stable
set search_path = public
as $$
  select w.unit_id,
         max(w.weighing_date) as last_weighing,
         count(*) filter (where w.weighing_date >= date_trunc('month', now())) as weighings_this_month
  from public.weighings w
  where w.unit_id is not null
    and w.canceled_at is null
  group by w.unit_id;
$$;

revoke all on function public.unit_weighing_stats() from public, anon;
grant execute on function public.unit_weighing_stats() to authenticated;


-- =============================================================
-- 0011_treatment_profile.sql
-- =============================================================

-- Cadastro completo de tipo de tratamento.
--
-- A tabela nasceu com nome e a marca de desvio de aterro. A tela pede
-- categoria, descrição, aplicação principal, observações e o fator de desvio.
--
-- O fator é o único campo aqui com efeito em número: até agora o desvio era
-- tudo ou nada — o peso inteiro contava ou não contava. Com ele, um
-- tratamento pode desviar parte do peso (coprocessamento que aproveita metade
-- da carga, por exemplo). Quem não mexer no campo não vê diferença alguma:
-- nulo significa "o peso inteiro quando considera desvio, nada quando não
-- considera", que é exatamente a conta de hoje.
--
-- Enquanto esta migração não for aplicada, a tela detecta a ausência das
-- colunas e desabilita os campos correspondentes.

alter table public.treatment_types
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists application text,
  add column if not exists notes text,
  add column if not exists diversion_factor smallint,
  add column if not exists updated_at timestamptz not null default now();

-- Percentual do peso que conta como desvio: de 0 a 100, ou nulo.
alter table public.treatment_types
  drop constraint if exists treatment_types_diversion_factor_range;
alter table public.treatment_types
  add constraint treatment_types_diversion_factor_range
  check (diversion_factor is null or (diversion_factor >= 0 and diversion_factor <= 100));

-- Mesmos limites que os contadores da tela mostram (0/500).
alter table public.treatment_types
  drop constraint if exists treatment_types_description_length;
alter table public.treatment_types
  add constraint treatment_types_description_length
  check (description is null or char_length(description) <= 500);

alter table public.treatment_types
  drop constraint if exists treatment_types_notes_length;
alter table public.treatment_types
  add constraint treatment_types_notes_length check (notes is null or char_length(notes) <= 500);

-- A coluna "Última atualização" da lista precisa de quem a mantenha: sem o
-- gatilho, `updated_at` congelaria na data de criação. A função vem da 0001.
drop trigger if exists trg_treatment_types_updated on public.treatment_types;
create trigger trg_treatment_types_updated before update on public.treatment_types
  for each row execute function public.set_updated_at();

create index if not exists idx_treatment_types_category on public.treatment_types(category);

-- -------------------------------------------------------------
-- Uso de cada tratamento
-- -------------------------------------------------------------
-- O indicador "Mais utilizado" e a aba de regras do painel mostram quantas
-- pesagens passaram por cada tratamento e quanto peso. Sem esta agregação, a
-- tela precisaria baixar a tabela de pesagens inteira para somar.
--
-- Sem `security definer`: a função roda com as permissões de quem chama, e
-- portanto respeita as políticas de leitura de `weighings`. Pesagens
-- canceladas não contam.
create or replace function public.treatment_usage_stats()
returns table (
  treatment_type_id uuid,
  weighings bigint,
  total_kg numeric,
  last_used timestamptz
)
language sql
stable
set search_path = public
as $$
  select w.treatment_type_id,
         count(*) as weighings,
         coalesce(sum(w.weight_kg), 0) as total_kg,
         max(w.weighing_date) as last_used
  from public.weighings w
  where w.treatment_type_id is not null
    and w.canceled_at is null
  group by w.treatment_type_id;
$$;

revoke all on function public.treatment_usage_stats() from public, anon;
grant execute on function public.treatment_usage_stats() to authenticated;


-- =============================================================
-- 0012_waste_type_profile.sql
-- =============================================================

-- Cadastro completo de tipo de resíduo.
--
-- A tabela nasceu com nome e cor. A tela pede código, categoria, classe da
-- NBR 10004, descrição, tratamento padrão, destinatário sugerido,
-- periculosidade e observações.
--
-- `is_divertible` não é campo novo do desenho: o formulário antigo de
-- resíduos já o gravava e o painel já o lê (indicador de desvio perdido), mas
-- a coluna nunca foi criada — quem salvava um tipo de resíduo recebia erro do
-- banco, e o indicador sempre calculava como se nada fosse desviável.
--
-- Enquanto esta migração não for aplicada, a tela detecta a ausência das
-- colunas e desabilita os campos correspondentes.

alter table public.waste_types
  add column if not exists code text,
  add column if not exists category text,
  add column if not exists waste_class text,
  add column if not exists description text,
  add column if not exists default_treatment_id uuid references public.treatment_types(id),
  add column if not exists suggested_recipient_id uuid references public.recipients(id),
  add column if not exists is_hazardous boolean not null default false,
  add column if not exists is_divertible boolean not null default false,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

-- Classes da NBR 10004. Lista fechada porque é uma norma, não uma escolha de
-- redação: "Classe IIA" e "Classe II A" seriam a mesma classe em dois nomes.
alter table public.waste_types
  drop constraint if exists waste_types_class_values;
alter table public.waste_types
  add constraint waste_types_class_values
  check (waste_class is null or waste_class in ('Classe I', 'Classe II A', 'Classe II B'));

-- Mesmos limites que os contadores da tela mostram (0/500).
alter table public.waste_types
  drop constraint if exists waste_types_description_length;
alter table public.waste_types
  add constraint waste_types_description_length
  check (description is null or char_length(description) <= 500);

alter table public.waste_types
  drop constraint if exists waste_types_notes_length;
alter table public.waste_types
  add constraint waste_types_notes_length check (notes is null or char_length(notes) <= 500);

-- O código identifica o resíduo num documento ou numa planilha; repetido, não
-- identifica nada. Resíduos sem código continuam válidos — em índice único,
-- vários nulos convivem.
create unique index if not exists idx_waste_types_code on public.waste_types(lower(code)) where code is not null;

-- A tela ordena e filtra por categoria e classe.
create index if not exists idx_waste_types_category on public.waste_types(category);
create index if not exists idx_waste_types_class on public.waste_types(waste_class);

-- Sem o gatilho, `updated_at` congelaria na data de criação. A função vem da
-- migração 0001.
drop trigger if exists trg_waste_types_updated on public.waste_types;
create trigger trg_waste_types_updated before update on public.waste_types
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- Uso de cada tipo de resíduo
-- -------------------------------------------------------------
-- A aba de regras do painel mostra quantas pesagens registraram cada resíduo
-- e quanto peso. Sem esta agregação, a tela precisaria baixar a tabela de
-- pesagens inteira para somar.
--
-- Sem `security definer`: a função roda com as permissões de quem chama, e
-- portanto respeita as políticas de leitura de `weighings`. Pesagens
-- canceladas não contam.
create or replace function public.waste_usage_stats()
returns table (
  waste_type_id uuid,
  weighings bigint,
  total_kg numeric,
  last_used timestamptz
)
language sql
stable
set search_path = public
as $$
  select w.waste_type_id,
         count(*) as weighings,
         coalesce(sum(w.weight_kg), 0) as total_kg,
         max(w.weighing_date) as last_used
  from public.weighings w
  where w.waste_type_id is not null
    and w.canceled_at is null
  group by w.waste_type_id;
$$;

revoke all on function public.waste_usage_stats() from public, anon;
grant execute on function public.waste_usage_stats() to authenticated;


-- =============================================================
-- 0013_missing_columns.sql
-- =============================================================

-- Colunas que o aplicativo já usa e que nenhuma migração cria.
--
-- Estas três não vêm de desenho nenhum: são colunas que o código grava e lê
-- hoje, mas que não existem em `0001_initial_schema.sql` nem em
-- `setup_all.sql`. Encontradas ao conferir o schema contra o código:
--
--   recipients.is_landfill               a importação de planilhas grava
--                                        (`imports.ts`) e o painel lê para
--                                        separar aterro de desvio
--   weighings.people_count               o formulário de pesagem grava
--                                        (`WeighingFormScreen`) e o painel
--                                        calcula a geração per capita
--   weighings.could_divert_from_landfill o mesmo formulário grava e o painel
--                                        calcula o desvio perdido
--
-- Se o banco em produção já tiver essas colunas — criadas à mão em algum
-- momento, fora do controle das migrações —, este arquivo não faz nada:
-- `add column if not exists` é justamente para isso. Se não tiver, ele
-- conserta o salvamento de pesagens, que hoje seria recusado pelo banco por
-- causa de duas colunas inexistentes.

alter table public.recipients
  add column if not exists is_landfill boolean not null default false;

alter table public.weighings
  add column if not exists people_count integer,
  add column if not exists could_divert_from_landfill boolean;

-- Quantidade de pessoas é base de divisão do indicador per capita: zero ou
-- negativo não é uma quantidade de pessoas, é um erro de digitação.
alter table public.weighings
  drop constraint if exists weighings_people_count_positive;
alter table public.weighings
  add constraint weighings_people_count_positive
  check (people_count is null or people_count > 0);

-- O painel separa o que foi para aterro; com muitas pesagens, o índice evita
-- varrer a tabela para responder.
create index if not exists idx_recipients_landfill on public.recipients(is_landfill) where is_landfill;


-- =============================================================
-- 0014_recipient_profile.sql
-- =============================================================

-- Cadastro completo de destinatário.
--
-- A tabela nasceu com nome, documento, e-mail e telefone. A tela pede tipo de
-- destinação, responsável, cidade/UF, licença ambiental, endereço, site,
-- observações — e uma situação com três estados, não dois.
--
-- Sobre a situação: a coluna `active` só diz sim ou não, e o desenho tem
-- "Ativo", "Pendente" e "Inativo". `status` passa a ser o campo que a tela
-- edita, e `active` continua existindo como espelho dele, porque é `active`
-- que o resto do sistema já lê (a escolha de destinatário na pesagem, a
-- importação de planilhas, os relatórios). O gatilho abaixo mantém os dois
-- coerentes: só é ativo quem está com o cadastro em ordem.
--
-- Enquanto esta migração não for aplicada, a tela detecta a ausência das
-- colunas e desabilita os campos correspondentes.

alter table public.recipients
  add column if not exists type text,
  add column if not exists contact_name text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists street text,
  add column if not exists neighborhood text,
  add column if not exists website text,
  add column if not exists license_number text,
  add column if not exists license_url text,
  add column if not exists status text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

-- Os três estados da situação.
alter table public.recipients
  drop constraint if exists recipients_status_values;
alter table public.recipients
  add constraint recipients_status_values
  check (status is null or status in ('active', 'pending', 'inactive'));

-- UF com duas letras: o campo da tela é uma sigla, não o nome do estado.
alter table public.recipients
  drop constraint if exists recipients_state_length;
alter table public.recipients
  add constraint recipients_state_length check (state is null or char_length(state) = 2);

-- Mesmo limite que o contador da tela mostra (0/500).
alter table public.recipients
  drop constraint if exists recipients_notes_length;
alter table public.recipients
  add constraint recipients_notes_length check (notes is null or char_length(notes) <= 500);

-- `active` espelha `status` quando ele é informado. Assim uma linha gravada
-- por código antigo (que só conhece `active`) continua válida, e uma gravada
-- pela tela nova não pode ficar "pendente e ativa" ao mesmo tempo.
create or replace function public.sync_recipient_active()
returns trigger
language plpgsql
as $$
begin
  if new.status is not null then
    new.active := (new.status = 'active');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recipients_status on public.recipients;
create trigger trg_recipients_status before insert or update on public.recipients
  for each row execute function public.sync_recipient_active();

-- Sem o gatilho, `updated_at` congelaria na data de criação. A função vem da
-- migração 0001.
drop trigger if exists trg_recipients_updated on public.recipients;
create trigger trg_recipients_updated before update on public.recipients
  for each row execute function public.set_updated_at();

create index if not exists idx_recipients_type on public.recipients(type);
create index if not exists idx_recipients_city on public.recipients(city);

-- -------------------------------------------------------------
-- Uso de cada destinatário
-- -------------------------------------------------------------
-- O indicador "Com vínculo no mês" conta quantos destinatários receberam
-- pesagem no mês, e a aba de histórico do painel mostra o acumulado de cada
-- um. Sem esta agregação, a tela precisaria baixar a tabela de pesagens
-- inteira para somar.
--
-- Sem `security definer`: a função roda com as permissões de quem chama, e
-- portanto respeita as políticas de leitura de `weighings`. Pesagens
-- canceladas não contam.
create or replace function public.recipient_usage_stats()
returns table (
  recipient_id uuid,
  weighings bigint,
  total_kg numeric,
  last_used timestamptz,
  weighings_this_month bigint
)
language sql
stable
set search_path = public
as $$
  select w.recipient_id,
         count(*) as weighings,
         coalesce(sum(w.weight_kg), 0) as total_kg,
         max(w.weighing_date) as last_used,
         count(*) filter (where w.weighing_date >= date_trunc('month', now())) as weighings_this_month
  from public.weighings w
  where w.recipient_id is not null
    and w.canceled_at is null
  group by w.recipient_id;
$$;

revoke all on function public.recipient_usage_stats() from public, anon;
grant execute on function public.recipient_usage_stats() to authenticated;


-- =============================================================
-- 0015_profile_cpf_birth.sql
-- =============================================================

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


-- =============================================================
-- Conferência — é o resultado que aparece na tela depois de rodar
-- =============================================================
-- Três blocos numa tabela só:
--   coluna  → cada coluna esperada, com "ok" ou "FALTANDO"
--   funcao  → cada função esperada, com "ok" ou "FALTANDO"
--   linhas  → quantas linhas cada tabela tem agora
--
-- O terceiro bloco é a prova de que nada foi perdido: compare com
-- o que você sabe do banco. Nenhum comando acima apaga linha.

with esperado_coluna(tabela, coluna) as (
  values
      ('weighings','seq'),
      ('profiles','notes'),
      ('profiles','cpf'),
      ('profiles','birth_date'),
      ('clients','trade_name'),
      ('clients','state_registration'),
      ('clients','segment'),
      ('clients','contact_name'),
      ('clients','contact_role'),
      ('clients','city'),
      ('clients','state'),
      ('clients','notes'),
      ('clients','updated_at'),
      ('units','code'),
      ('units','type'),
      ('units','contact_name'),
      ('units','phone'),
      ('units','street'),
      ('units','neighborhood'),
      ('units','state'),
      ('units','postal_code'),
      ('units','notes'),
      ('units','updated_at'),
      ('treatment_types','category'),
      ('treatment_types','description'),
      ('treatment_types','application'),
      ('treatment_types','notes'),
      ('treatment_types','diversion_factor'),
      ('treatment_types','updated_at'),
      ('waste_types','code'),
      ('waste_types','category'),
      ('waste_types','waste_class'),
      ('waste_types','description'),
      ('waste_types','default_treatment_id'),
      ('waste_types','suggested_recipient_id'),
      ('waste_types','is_hazardous'),
      ('waste_types','is_divertible'),
      ('waste_types','notes'),
      ('waste_types','updated_at'),
      ('recipients','is_landfill'),
      ('weighings','people_count'),
      ('weighings','could_divert_from_landfill'),
      ('recipients','type'),
      ('recipients','contact_name'),
      ('recipients','city'),
      ('recipients','state'),
      ('recipients','postal_code'),
      ('recipients','street'),
      ('recipients','neighborhood'),
      ('recipients','website'),
      ('recipients','license_number'),
      ('recipients','license_url'),
      ('recipients','status'),
      ('recipients','notes'),
      ('recipients','updated_at')
),
esperada_funcao(nome) as (values ('admin_list_users'), ('unit_weighing_stats'), ('treatment_usage_stats'), ('waste_usage_stats'), ('recipient_usage_stats'), ('sync_recipient_active'), ('next_weighing_seq'), ('set_weighing_seq'))
select 'coluna' as tipo,
       e.tabela || '.' || e.coluna as item,
       case when c.column_name is null then 'FALTANDO' else 'ok' end as situacao
  from esperado_coluna e
  left join information_schema.columns c
    on c.table_schema = 'public' and c.table_name = e.tabela and c.column_name = e.coluna
union all
select 'funcao',
       f.nome,
       case when p.proname is null then 'FALTANDO' else 'ok' end
  from esperada_funcao f
  left join pg_proc p
    on p.proname = f.nome
   and p.pronamespace = 'public'::regnamespace
union all
select 'linhas' as tipo, 'profiles' as item, count(*)::text as situacao from public.profiles
  union all select 'linhas' as tipo, 'clients' as item, count(*)::text as situacao from public.clients
  union all select 'linhas' as tipo, 'units' as item, count(*)::text as situacao from public.units
  union all select 'linhas' as tipo, 'waste_types' as item, count(*)::text as situacao from public.waste_types
  union all select 'linhas' as tipo, 'treatment_types' as item, count(*)::text as situacao from public.treatment_types
  union all select 'linhas' as tipo, 'recipients' as item, count(*)::text as situacao from public.recipients
  union all select 'linhas' as tipo, 'weighings' as item, count(*)::text as situacao from public.weighings
order by 1, 3 desc, 2;

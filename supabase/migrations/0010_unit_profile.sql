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

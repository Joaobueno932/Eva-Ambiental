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

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

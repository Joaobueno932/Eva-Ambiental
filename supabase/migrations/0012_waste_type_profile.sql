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

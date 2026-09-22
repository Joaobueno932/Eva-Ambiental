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

-- Normaliza o que já está gravado antes de exigir a forma. Sem isto, num
-- banco onde a coluna foi criada à mão e preenchida com string vazia, o
-- `alter table` abaixo falharia e derrubaria a migração inteira.
--
-- UF vazia não é uma UF: é a ausência dela, e o lugar disso é o nulo. E a
-- sigla é maiúscula por definição — "Ms" e "MS" são o mesmo estado, mas só um
-- deles aparece na lista de escolha da tela.
update public.recipients set state = null
 where state is not null and btrim(state) = '';
update public.recipients set state = upper(btrim(state))
 where state is not null and state <> upper(btrim(state));

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

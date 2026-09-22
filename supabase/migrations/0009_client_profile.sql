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

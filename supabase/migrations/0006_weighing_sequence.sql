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

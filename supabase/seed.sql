-- =============================================================
-- Eva Ambiental — Dados iniciais (seeds)
-- =============================================================
-- Insere tipos de resíduos, tipos de tratamento e exemplos de
-- cliente/unidade/destinatário para começar a usar o app.
-- Idempotente: pode rodar mais de uma vez sem duplicar.
-- =============================================================

-- ---------------- Tipos de resíduos ----------------
insert into public.waste_types (name, color) values
  ('Orgânico',          '#4D8E26'),
  ('Vidro',             '#0891B2'),
  ('Rejeito',           '#6B7280'),
  ('Papelão',           '#CA8A04'),
  ('Plástico',          '#DC2626'),
  ('Plástico Duro',     '#B91C1C'),
  ('Plástico Mole',     '#F87171'),
  ('Latas de Alumínio', '#9CA3AF'),
  ('Cartonagem',        '#D97706'),
  ('Metal em Geral',    '#64748B'),
  ('Óleo',              '#7C3AED'),
  ('MDF',               '#A16207'),
  ('Tecido',            '#2563EB')
on conflict do nothing;

-- ---------------- Tipos de tratamento ----------------
insert into public.treatment_types (name, counts_as_diversion) values
  ('Compostagem',     true),
  ('Reciclagem',      true),
  ('Reaproveitamento',true),
  ('Aterro',          false)
on conflict do nothing;

-- ---------------- Exemplo de cliente / unidade / destinatário ----------------
insert into public.clients (id, name, document, email, phone)
values ('11111111-1111-1111-1111-111111111111', 'Cliente Demonstração', '00.000.000/0001-00', 'contato@cliente.com', '(11) 90000-0000')
on conflict (id) do nothing;

insert into public.units (id, client_id, name, city, address)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Unidade Central', 'São Paulo', 'Av. Exemplo, 123')
on conflict (id) do nothing;

insert into public.recipients (id, name, document, email, phone)
values ('33333333-3333-3333-3333-333333333333', 'Cooperativa Recicla', '11.111.111/0001-11', 'coop@recicla.com', '(11) 91111-1111')
on conflict (id) do nothing;

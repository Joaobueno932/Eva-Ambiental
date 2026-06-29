-- =============================================================
-- Eva Ambiental — Storage (bucket de fotos das pesagens)
-- =============================================================
-- Cria o bucket privado `weighing-photos` e suas policies.
-- Caminho dos arquivos: weighing-photos/{weighing_id}/{timestamp}.jpg
-- =============================================================

insert into storage.buckets (id, name, public)
values ('weighing-photos', 'weighing-photos', false)
on conflict (id) do nothing;

-- Leitura: qualquer usuário ativo (Viewer inclusive) — as fotos só são
-- exibidas vinculadas a pesagens que o RLS de weighings já permite ver.
drop policy if exists "weighing_photos_read" on storage.objects;
create policy "weighing_photos_read" on storage.objects
  for select
  using (
    bucket_id = 'weighing-photos'
    and public.is_active()
  );

-- Upload: admin ou analyst ativos.
drop policy if exists "weighing_photos_insert" on storage.objects;
create policy "weighing_photos_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'weighing-photos'
    and public.can_write_weighings()
  );

-- Atualização (overwrite): admin ou analyst ativos.
drop policy if exists "weighing_photos_update" on storage.objects;
create policy "weighing_photos_update" on storage.objects
  for update
  using (
    bucket_id = 'weighing-photos'
    and public.can_write_weighings()
  );

-- Remoção: somente admin.
drop policy if exists "weighing_photos_delete" on storage.objects;
create policy "weighing_photos_delete" on storage.objects
  for delete
  using (
    bucket_id = 'weighing-photos'
    and public.is_admin()
  );

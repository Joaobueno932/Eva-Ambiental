# ✅ Eva Ambiental — Checklist de Release (teste real em Android físico)

Use este guia para validar o app de ponta a ponta com um **Supabase real** e um **aparelho Android físico**.

---

## 1. Configuração do Supabase

- [ ] Criar projeto em <https://supabase.com>.
- [ ] **SQL Editor** → executar **nesta ordem**:
  - [ ] `supabase/migrations/0001_initial_schema.sql`
  - [ ] `supabase/migrations/0002_storage.sql`
  - [ ] `supabase/seed.sql`
- [ ] Confirmar que o bucket **`weighing-photos`** foi criado como **privado** (Storage → Buckets → *public* = OFF).
- [ ] Deploy da Edge Function: `supabase functions deploy admin-create-user`.
- [ ] Em **Project Settings → API**, copiar **Project URL** e **anon key**.

### `.env`
- [ ] `cp .env.example .env` e preencher:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  ```
- [ ] Confirmar que **nenhuma `service_role` key** está no app (só na Edge Function, no servidor).

---

## 2. Criação do primeiro Admin

- [ ] **Authentication → Users → Add user** (marcar *Auto Confirm User*).
- [ ] Promover a admin no SQL Editor:
  ```sql
  update public.profiles set role = 'admin', active = true
  where email = 'seu-admin@empresa.com';
  ```
- [ ] Login no app com esse admin funciona.

---

## 3. Teste dos 3 perfis

Crie um usuário de cada perfil (Perfil → Administração → Usuários, logado como admin).

### Admin
- [ ] Vê o Painel completo e gera PDF/CSV.
- [ ] Registra pesagem (FAB `+` visível).
- [ ] Em uma pesagem **pendente**: **Aprovar** e **Rejeitar** (com motivo) funcionam.
- [ ] Edita qualquer pesagem.
- [ ] Administração visível: cria/edita usuários, ativa/desativa, define perfil; gerencia clientes, unidades, resíduos, tratamentos, destinatários.

### Analista
- [ ] Registra pesagem (FAB `+` visível) com foto e GPS.
- [ ] Edita **apenas** as próprias pesagens **pendentes**.
- [ ] **Não** vê Aprovar/Rejeitar.
- [ ] **Não** acessa Administração (card não aparece no Perfil).
- [ ] Gera PDF/CSV.

### Visualizador
- [ ] Vê Painel e lista (sem botão `+`).
- [ ] Abre detalhes e amplia fotos.
- [ ] **Não** registra, edita ou aprova.
- [ ] Gera PDF/CSV.

### Usuário inativo
- [ ] Desativar um usuário (Administração → Usuários → editar → *Usuário ativo* OFF).
- [ ] Tentar logar com ele: o acesso é **bloqueado imediatamente após o login** e aparece a mensagem *"Seu acesso está inativo. Procure um administrador."*

---

## 4. Teste de Câmera (permissões Android)

- [ ] Nova Pesagem → **Tirar foto agora** → abre a câmera do aparelho.
- [ ] Após a foto, **data/hora** são preenchidas automaticamente.
- [ ] **Câmera negada**: app mostra aviso amigável e não quebra.

## 5. Teste de GPS / Localização

- [ ] Ao tirar foto com permissão concedida: **latitude/longitude** capturadas e exibidas.
- [ ] **Localização negada**: app avisa e **salva a pesagem sem coordenadas** (sem travar).
- [ ] **Anexar imagem** (galeria): aparecem os campos opcionais de **localização manual / data / hora**.
- [ ] **Galeria negada**: aviso amigável, sem crash.

## 6. Teste de Upload (Storage)

- [ ] Salvar pesagem com foto → upload conclui e aparece o **modal de sucesso da Eva**.
- [ ] Detalhes da pesagem → a foto aparece (via **URL assinada**, bucket privado).
- [ ] Ampliar a foto (toque) funciona.
- [ ] Como Visualizador: consegue ver a foto das pesagens visíveis.

## 7. Teste de Relatório PDF

- [ ] Painel → Relatórios → **PDF** → abre o compartilhamento com o PDF.
- [ ] PDF contém: cabeçalho Eva Ambiental, período, resumo, distribuições e detalhamento das pesagens.

## 8. Teste de CSV

- [ ] Painel → Relatórios → **CSV** → compartilha o arquivo `.csv`.
- [ ] Abrir no Excel/Sheets: acentuação correta (BOM) e colunas separadas (`;`).

## 9. Rede / Offline

- [ ] Ativar **modo avião** e abrir o app: telas mostram mensagem amigável, **sem spinner infinito**.
- [ ] Login sem internet: mensagem *"Sem conexão com o servidor..."*.
- [ ] Reconectar e usar **pull-to-refresh** / botão Atualizar: dados carregam normalmente.

---

## 10. Build e teste do APK em Android físico

- [ ] `npm install`
- [ ] `npx tsc --noEmit` (sem erros)
- [ ] `npx expo export --platform android` (bundle gerado)
- [ ] `npm install -g eas-cli && eas login`
- [ ] `eas build:configure` (gera o `projectId`)
- [ ] `eas build -p android --profile preview` → baixar o **APK**.
- [ ] Instalar o APK no aparelho (permitir *fontes desconhecidas*).
- [ ] Verificar no launcher: **ícone da Eva** e **nome "Eva Ambiental"**.
- [ ] Abrir: **splash verde** com a Eva centralizada.
- [ ] Conceder permissões quando solicitado (câmera, localização, fotos).
- [ ] Rodar novamente os testes 3–9 no aparelho real.

---

## Notas de produção

- **Storage**: bucket `weighing-photos` é **privado**; o app gera **URLs assinadas** (validade 1h) para exibir as fotos — nada fica público.
- **Segurança**: RLS ativo em todas as tabelas; criação de usuários só via Edge Function (admin ativo).
- **Ícone/Splash**: gerados de `img/logo icone.png` (alta resolução) para `assets/`.
- **Resiliência**: o componente `EvaImage` cai num ícone de folha se a arte falhar; nenhuma tela fica em carregamento infinito (todas tratam erro com `try/finally`).

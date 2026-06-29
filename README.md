# 🌱 Eva Ambiental

Aplicativo **Android** para **controle, registro, monitoramento e rastreabilidade de pesagens de resíduos**.

Construído com **React Native + Expo + TypeScript** e **Supabase** (Auth, PostgreSQL, Storage) com **Row Level Security** em todas as tabelas.

---

## ✨ Funcionalidades

- Login com sessão persistente e verificação de usuário ativo
- 3 perfis de acesso: **Admin**, **Analista** e **Visualizador**
- Registro de pesagens com **foto pela câmera + geolocalização automática** ou **anexo da galeria** (com localização manual opcional)
- Fluxo de **aprovação/rejeição** de pesagens
- **Dashboard** com indicadores, gráficos e **Taxa de Desvio de Aterro**
- **Relatórios em PDF e CSV**
- Área administrativa: usuários, clientes, unidades, tipos de resíduos, tipos de tratamento e destinatários
- Criação de usuários **segura** via Supabase Edge Function (service role no servidor)

---

## 🦫 Mascote Eva (imagens)

As imagens da mascote ficam na pasta **`/img`** (na raiz) e são centralizadas em
`src/theme/images.ts`. O componente **`EvaImage`** as exibe de forma resiliente:
se uma imagem falhar ao carregar, mostra um ícone de folha no lugar — **o app nunca quebra**.

| Imagem | Onde é usada |
|--------|--------------|
| `img/eva-hero.png` (Eva acenando) | **Login** (boas-vindas), **estados vazios** do Painel e da lista de Pesagens |
| `img/eva.png` (Eva apontando) | **Modal de sucesso** ao salvar pesagem, **modal de Ajuda** |
| `img/eva-perfil.jpg` (retrato) | **Selo de marca** no rodapé do Perfil, **modal Sobre** |
| `img/logo icone.png` (ícone) | **Ícone do app** — origem de `assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash.png` e `assets/favicon.png` |

> Os assets em `assets/` são gerados a partir de `img/logo icone.png`. Para regenerá-los
> após trocar a arte, basta reescalar a imagem 1024×1024 para esses quatro arquivos.

> **Otimização:** as imagens da Eva foram reduzidas para **no máx. 512px** no maior lado
> (são exibidas em ≤200px). `eva-hero` e `eva` permanecem em PNG (transparência);
> `eva-perfil` é JPEG (fundo opaco). Resultado: ~3,3 MB → **~470 KB** no total.

> A Eva é usada de forma estratégica (boas-vindas, vazios, sucesso, ajuda/sobre e marca),
> sem poluir as telas operacionais.

## 🎨 Identidade visual (Eva)

| Cor | Hex |
|-----|-----|
| Verde principal | `#63B32E` |
| Verde escuro | `#4D8E26` |
| Verde claro | `#A7D86E` |
| Fundo claro | `#EEF8E7` |
| Texto | `#1F2937` |

---

## 📁 Estrutura do projeto

```
.
├── App.tsx
├── app.json                # config Expo + permissões Android
├── eas.json                # perfis de build (APK)
├── .env.example
├── assets/                 # ícones e splash do app
├── img/                    # imagens da mascote Eva (hero, apontando, retrato)
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql   # tabelas, funções, triggers, RLS
│   │   └── 0002_storage.sql          # bucket + policies de Storage
│   ├── seed.sql                      # dados iniciais
│   └── functions/
│       └── admin-create-user/        # Edge Function (criação segura de usuários)
└── src/
    ├── components/         # Button, Input, Card, Select, PhotoPicker, etc.
    ├── contexts/           # AuthContext
    ├── hooks/              # usePermissions
    ├── lib/                # cliente Supabase
    ├── navigation/         # abas + stacks
    ├── screens/            # telas (+ admin/)
    ├── services/           # acesso ao Supabase
    ├── theme/              # cores, espaçamentos
    ├── types/              # tipos do domínio
    └── utils/              # formatação, relatórios, períodos
```

---

## 🚀 1. Configurar o Supabase

1. Crie um projeto em <https://supabase.com>.
2. Em **Project Settings → API**, copie:
   - **Project URL**
   - **anon public key**

### Rodar as migrations

**Opção A — SQL Editor (mais simples):**
1. Abra **SQL Editor** no painel do Supabase.
2. Cole e execute, **nesta ordem**:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_storage.sql`
   - `supabase/seed.sql`

**Opção B — Supabase CLI:**
```bash
npm install -g supabase
supabase link --project-ref <SEU_PROJECT_REF>
supabase db push          # aplica as migrations
# em seguida rode o seed.sql pelo SQL Editor, ou:
supabase db execute --file supabase/seed.sql
```

### Bucket de Storage
O bucket privado `weighing-photos` é criado pela migration `0002_storage.sql`.
Caso prefira criar manualmente: **Storage → New bucket → `weighing-photos` (private)** e rode apenas as policies do arquivo.

### Edge Function (criação segura de usuários)
```bash
supabase functions deploy admin-create-user
```
As secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem por padrão no projeto Supabase.

---

## 🔑 2. Criar o primeiro Admin

Como a criação de usuários exige um admin, crie o **primeiro admin manualmente**:

1. **Authentication → Users → Add user** → informe e-mail e senha (marque *Auto Confirm User*).
2. O trigger `handle_new_user` cria automaticamente um `profile` com role `viewer`.
3. Promova-o a admin no **SQL Editor**:
   ```sql
   update public.profiles set role = 'admin', active = true
   where email = 'seu-admin@empresa.com';
   ```

A partir daí, novos usuários podem ser criados **dentro do app** (Perfil → Administração → Usuários).

---

## ⚙️ 3. Configurar o `.env`

Copie o exemplo e preencha:
```bash
cp .env.example .env
```
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```
> Nunca coloque a **service_role key** no app. Ela só é usada na Edge Function (servidor).

---

## ▶️ 4. Rodar o projeto

```bash
npm install
npx expo start
```
Abra no **Expo Go** (Android) lendo o QR Code, ou pressione `a` para abrir no emulador.

> Dica: se aparecerem avisos de versão de pacotes, rode `npx expo install --fix` para alinhar com a versão do Expo SDK.

---

## 📦 5. Gerar APK Android

```bash
npm install -g eas-cli
eas login
eas build:configure          # cria/atualiza o projectId
eas build -p android --profile preview
```
O perfil `preview` (em `eas.json`) gera um **APK** instalável. Ao final, o EAS fornece um link para download.

> ⚠️ **Importante (evita crash de inicialização no APK):** o `.env` **não** é enviado ao EAS Build.
> As variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` precisam estar no
> **`eas.json`** (campo `env` de cada profile) — já estão configuradas lá. Por serem chaves
> públicas (URL + publishable key, embarcadas no app), podem ficar no `eas.json`. Se faltarem,
> o app agora mostra uma tela de "Configuração ausente" em vez de fechar.
>
> Para forçar um build limpo: `eas build -p android --profile preview --clear-cache`.

Build local (opcional, requer Android SDK):
```bash
npx expo prebuild
npx expo run:android
```

---

## 👥 6. Como testar cada perfil

Crie um usuário de cada perfil (via área administrativa, com um admin logado) e valide:

### 🔴 Admin
- Vê o **Painel** completo e gera **PDF/CSV**.
- Registra pesagens (FAB `+` visível).
- Abre uma pesagem **pendente** → **Aprovar** / **Rejeitar** (com motivo).
- Edita **qualquer** pesagem.
- **Administração** disponível: cria usuários, ativa/desativa, define perfil; gerencia clientes, unidades, tipos de resíduos/tratamento e destinatários.

### 🟡 Analista
- Registra pesagens (FAB `+` visível) com foto e GPS.
- Edita **apenas** pesagens **criadas por ele** e ainda **pendentes**.
- **Não** vê botões de Aprovar/Rejeitar.
- **Não** acessa a área de Administração.
- Gera PDF/CSV.

### 🟢 Visualizador
- Vê o **Painel** e a **lista de pesagens** (sem o botão `+`).
- Abre detalhes e amplia fotos.
- **Não** registra, **não** edita, **não** aprova.
- Gera PDF/CSV.

> Teste também **usuário inativo**: desative um usuário na Administração e tente logar — o acesso é bloqueado com aviso amigável.

---

## 🔒 Segurança (RLS) — resumo

- RLS habilitado em **todas** as tabelas.
- Leitura de dados: qualquer usuário **ativo**.
- Pesagens: criação por admin/analyst; analista edita só as próprias **pendentes**; aprovação/rejeição só por admin.
- Cadastros mestres e usuários: apenas admin escreve.
- Usuário **inativo** não acessa (verificado no login e via funções de RLS).
- Storage `weighing-photos`: leitura por usuários ativos, upload por admin/analyst, remoção só por admin.

### 📷 Fotos: bucket privado + URLs assinadas

O bucket **`weighing-photos` é privado** (não público). O app **nunca** usa URL pública:
as fotos são exibidas por meio de **URLs assinadas** geradas sob demanda
(`createSignedUrl`, validade de 1 hora) em `src/services/photos.ts`. Assim, só usuários
autenticados e ativos — respeitando o RLS das pesagens — conseguem visualizar as imagens.

---

## 🧩 Comandos úteis

```bash
npm install                              # instala dependências
npx expo start                           # inicia o app em desenvolvimento
npx expo install --fix                   # alinha versões ao Expo SDK
npm run lint                             # checagem de tipos (tsc --noEmit)
npx expo prebuild                        # gera projeto nativo Android
eas build -p android --profile preview   # gera APK
```

🌱 *Eva Ambiental — sustentabilidade, confiança e organização.*

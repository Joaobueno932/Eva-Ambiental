# Eva Ambiental — redesign operacional

## Arquitetura verificada

- Expo 54, React Native 0.81.5, React 19.1 e React Navigation 7.
- Navegação compartilhada: abas inferiores em telas pequenas, sidebar no desktop e stacks de pesagens/perfil. URLs existentes preservadas; `/relatorios` acrescentada.
- `usePermissions` e migration `0005`: Admin e Analista aprovam, rejeitam e cancelam. Operador cria e edita suas pesagens pendentes; Visualizador consulta/exporta. Admin gerencia cadastros e usuários. Registros cancelados não são editáveis na interface.
- A RLS do Analista permite atualização ampla; as restrições de edição por propriedade/status estão na aplicação. Nenhuma policy foi alterada para este redesign.
- AuthContext valida perfil ativo e papel reconhecido. Autenticação e Edge Function de criação de usuários preservadas.
- Fotos: upload binário autenticado; bucket privado `weighing-photos`; URLs assinadas de uma hora para visualização. Download individual/ZIP preservado.
- Câmera/galeria: Expo Image Picker no Android; seletor HTML e compressão JPEG no navegador. GPS via Expo Location; endereço via geocodificador nativo/Nominatim na Web. Campos manuais e endereço da unidade mantidos.
- PDF: Expo Print/Sharing no app; impressão de iframe no navegador. CSV e Excel mantêm os geradores e adaptadores de download existentes.
- Cancelamento continua lógico, com motivo e gravação em audit_logs pelo serviço existente. A timeline mostra os eventos persistidos na própria pesagem, não presume um histórico completo de auditoria.

## Interface

- Tokens compartilhados de cores, medidas, tipografia, bordas e breakpoints. Acento lima reservado às ações e seleção.
- Dashboard com indicadores agrupados, situação dos registros, evolução diária, distribuições, indicadores anteriores e registros recentes. Dados reais das consultas existentes; sem substituição por dados demonstrativos.
- Pesagens: tabela desktop, paginação local de 20 registros e drawer de detalhes. Fechar o drawer atualiza os dados sem desmontar a lista; busca, filtros e página são mantidos. Mobile mantém cartões e ação prioritária de registro.
- Cadastro dividido em origem, classificação, pesagem/destinação, evidência e revisão. Resumo lateral em telas amplas. Validação final direciona à etapa com erro. Campos e serviços de persistência preservados.
- Ficha de rastreabilidade destaca massa, identificação, eventos, evidências e decisões autorizadas.
- Relatórios têm escopo, contagem e exportação próprios. Indicadores consideram pendentes/aprovadas; exportações mantêm rejeitadas e excluem canceladas, como os serviços existentes.
- Cadastros compartilham tabela, busca, formulários e estados. Usuários seguem o mesmo padrão visual sem alterar seu serviço de administração.
- Login responsivo; assets e fallback de EvaImage preservados.

## Verificação

`npm run lint` já era um alias de `tsc --noEmit`, sem ESLint separado. Acrescentados `npm run typecheck` e `npm test` (Node Test Runner com TypeScript compilado em memória, sem novas dependências).

13 testes cobrem os quatro perfis, usuários inativos, propriedade/estado dos registros, separação de escopos de indicadores/exportação e eventos de rastreabilidade. São testes locais; não verificam policies implantadas no Supabase.

Build Web e exportação de bundle Android foram executados. A exportação Android não equivale a instalar/testar um APK. Expo iniciou com `--offline`; a verificação online de dependências apresentou `fetch failed` neste ambiente.

Navegador: login e validações obrigatórias verificados em 1440×1000, 768×1024 e 390×844, sem overflow horizontal nem exceções JavaScript. A rota direta `/relatorios` apresentou login quando não autenticada.

### Homologação ainda necessária

Sem contas de homologação/dispositivo disponibilizados, não foram executadas transações reais de login/logout, criação/edição/decisão/cancelamento, upload e leitura de signed URLs, câmera/galeria/GPS, exportação PDF/CSV/Excel ou administração. Revisar também navegação autenticada direta e layout com dados reais em todos os perfis. Os testes locais e os builds não substituem essa homologação.

Nenhum dado remoto foi criado ou modificado na implementação. Alterações já presentes no workspace foram preservadas.

# Meu Backstage — Organização Criativa

Painel independente, com seis áreas: **Ideias, Calendário, Conteúdos, Projetos e tarefas, Estudos e Resultados**. Reaproveita o editor, listas, Kanban, calendário, formulários, esquema e identidade do Backstage original. O site público continua em outra branch/Worker e não é modificado.

**Estado:** código e ensaios locais preparados. Ainda não há projeto Supabase real conectado nem endereço online funcional validado. Os testes de navegador usam HTTP Supabase simulado; permissões são testadas com PostgreSQL/PGlite real local. Não confundir esses testes com login ou persistência em produção.

## Conexão indispensável na sua conta

1. Criar projeto **Supabase Free dedicado**. Não ativar Pro, add-ons ou cadastrar cartão por solicitação deste projeto. Se a plataforma exigir pagamento, interromper.
2. Em **Authentication → Sign In / Providers** (ou configurações de Auth), desabilitar **Allow new users to sign up**. Em **Authentication → Users → Add user / Create new user**, criar **somente sua conta**, com e-mail próprio e senha forte (recomendado12+ caracteres); confirmar o e-mail pelo fluxo administrativo. Não enviar senha no chat. Login da conta Supabase e login do painel são contas distintas.
3. Em **SQL Editor → New query**, colar e executar [supabase/INSTALL.sql](supabase/INSTALL.sql). Ele instala tabelas, funções e bucket privado numa transação e autoriza somente o UUID da única conta Auth criada. Se houver várias contas, o script para e pede revisão; não autoriza todas. Não executar em banco compartilhado com outros projetos sem revisão.
4. Em **Project Settings / Connect / API Keys**, obter a URL pública `https://....supabase.co` e a **publishable key** (ou `anon` legado). Usar nos campos `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. São configuração pública, não senha. **Nunca usar `service_role`, `sb_secret_`, senha do banco ou token pessoal no frontend.** O build recusa chaves privilegiadas.
5. Na Cloudflare, criar **outro Worker** conectado ao mesmo GitHub/repositório, branch **`backstage-criativo`**, nome **`meu-backstage-incomodo`**. Build: `npm run build`; deploy: `npm run deploy`; raiz do repositório. Adicionar as duas variáveis públicas acima às variáveis de **build**. Não alterar o Worker público `inc-modo-coletivo`, sua branch ou domínio. Plano Free, sem banco Cloudflare/R2/recursos pagos.

Depois de conectado, validar login real e regras; somente então importar a cópia e liberar uso diário. O endereço será o `workers.dev` que a Cloudflare fornecer para esse Worker; não existe URL publicada presumida aqui.

## Uso

- Entrar com e-mail/senha da conta autorizada. Não há cadastro público.
- Escolher uma das seis áreas. Algumas possuem abas para os módulos originais (pautas, pilares, artigos, projetos, tarefas, laboratório, estudos, carreira, diário e metas).
- **Adicionar → preencher → Salvar registro**. Pesquisa, filtros, lista/Kanban e calendário foram reaproveitados. Resultado só é confirmado após resposta do armazenamento.
- Pauta pode virar planejamento; conversão é transacional/idempotente. Calendário pode ser duplicado sem data. Nenhuma ação publica no site ou nas redes sociais.
- Resultados são anotações manuais de alcance, visualizações e aprendizados, sem analytics fictício.
- **Atualizar** busca dados do serviço. Fechar o navegador não apaga dados salvos. Edições concorrentes são detectadas ao salvar; texto não confirmado deve ser copiado antes de recarregar. Há aviso ao fechar a página com editor aberto. Não existe autosave de rascunho não salvo.
- **Exportar backup** baixa JSON privado com todos os registros e anexos, sem senhas/tokens. Guardar fora da hospedagem em local protegido. **Importar cópia** valida IDs/hashes, não duplica registros iguais e recusa conflitos sem sobrescrever. Importação de registros é transacional. Arquivos são privados e incluídos no backup; exclusão de registro não apaga anexos automaticamente para evitar perda de referências.
- Logout encerra a sessão neste dispositivo. Não há colaboração multiusuário, publicação automática, CRM, pagamentos ou contratos.

## Migração preservada

`scripts/export-original.mjs` lê somente uma cópia SQLite validada, exporta os tipos criativos com todos os campos e mantém IDs/datas/referências. Não exporta administradores, hashes, sessões, settings comerciais, CRM ou catálogo de serviços. O original continua íntegro em seu checkout e backup completo.

O pacote real foi gerado fora do Git em `/workspace/private-backups/backstage-criativo-20261030/migracao-criativa.json`, permissão600: **36 registros**, incluindo **10 pautas e6 estudos**, sem anexos referenciados nessa cópia. A importação foi ensaiada em PostgreSQL local/PGlite com igualdade de todos os dados, IDs e datas, repetição sem duplicação e rollback de conflito. Nada foi enviado para Supabase nesse ensaio.

Depois do projeto real configurado e validado, baixar o pacote por canal privado e selecionar **Importar cópia**. Comparar contagens/campos no projeto real e testar exportação/restauração antes de migrar a rotina. Nunca colocar o pacote, o banco ou backups no GitHub, numa URL pública ou em `public/`.

## Segurança e persistência

O navegador usa Supabase Auth e uma chave pública. As tabelas têm RLS e exigem `auth.uid()` igual ao proprietário autorizado em `backstage_owners`; o navegador não pode adicionar proprietários. Outra conta não lê nem grava, mesmo conhecendo endpoints/IDs. O bucket Storage é privado e protegido também por política restritiva contra permissões amplas preexistentes. Senhas são administradas pelo Supabase; os hashes scrypt do sistema antigo não são publicados nem migrados como senha nova.

O login guarda uma sessão no dispositivo para permitir continuidade; **os conteúdos não são armazenados apenas no navegador**. Tokens não entram no backup. O serviço renovará a sessão segundo suas políticas; não há link de recuperação de senha fingidamente funcional. Configuração de recuperação deve ser validada na conta Auth antes de anunciá-la.

Cloudflare serve somente o aplicativo estático com HTTPS, noindex e cabeçalhos de segurança. HTML/CSS/JS do aplicativo podem ser baixados por visitantes; isso não contém os registros privados, cuja autorização ocorre no banco. Não confiar em esconder menus como proteção.

## Custos e limites

Cloudflare Free para assets e Supabase Free para Auth/PostgreSQL/Storage. Nenhum serviço contratado. A tabela Supabase consultada inclui500MB de banco,1GB de arquivos e quotas de transferência; pode pausar após uma semana inativo. Não há SLA ou backup gerenciado equivalente ao plano pago. Não prometer disponibilidade ilimitada ou recuperação automática: fazer exportações regulares e guardar uma cópia fora do serviço. Ao atingir limites, interromper e informar; não ativar cobrança automaticamente.

## Desenvolvimento e verificação

Node22+ para Vite/Workers; exportação do SQLite original requer Node24. `npm ci`, configurar somente as duas variáveis públicas em `.env.local`, `npm run dev`. `npm run build` verifica configuração, TypeScript e produz `dist/`. Worker separado definido em `wrangler.jsonc`; o build sem projeto configurado **falha de propósito**, evitando publicar um login falso/inoperante.

- `npm test`: PostgreSQL/PGlite com roles e RLS reais locais. Inclui bloqueio de anon/outro usuário, promoção de proprietário proibida, CRUD dos tipos criativos, transações, idempotência, metadados e bucket privado.
- `BACKSTAGE_MIGRATION_COPY=/caminho/privado/pacote.json npm test`: usa a cópia real no ensaio local, sem envio à rede. Sem essa variável, o CI usa fixtures sintéticas, sem dados privados.
- `npm run test:browser`: Playwright, serviço Supabase HTTP **simulado**, CRUD dos formulários reaproveitados, outro contexto de navegador, erro de gravação sem falso sucesso, pesquisa, conversão de pauta, anexos, exportação/restauração e celular. Instalar Chromium com `npx playwright install chromium` ou definir CHROMIUM_PATH.
- CI usa `example.supabase.co` e chave pública de teste apenas para compilar/testar. Não publica nem comprova conexão Supabase real. Nenhum dado pessoal fica em fixtures ou artefatos do repositório.

Antes da entrega online: confirmar signup desabilitado, login real apenas da responsável, bloqueio de anon/outro usuário, gravação real após reabrir e em outro dispositivo, importação privada e contagens, permissões de anexos e restauração de backup. Não afirmar esses passos como concluídos enquanto não forem executados no projeto real.


## Retomada preservada em 03/11/2026

A aplicação original Next.js/SQLite e seus backups continuam privados e intocados.
A cópia de trabalho deste painel é independente. A migração dos 36 registros foi
regenerada de uma cópia consistente do SQLite e ensaiada localmente; não foi
publicada nem enviada ao Supabase. O banco dedicado agora limita a autorização
a uma única proprietária também por índice único, além das políticas RLS.

`npm run verify:connection` executa somente leituras contra o projeto Supabase
real configurado: valida Auth, cadastro público desativado e bloqueio anônimo
das três tabelas. Não faz login, não importa dados e não comprova persistência
ou restauração. Esses testes exigem a conexão real e a conta autorizada.

O CI inclui as branches de preparação `finalizar-backstage-*`. Ele usa apenas
fixtures sintéticas; a migração privada permanece fora do repositório e dos
artefatos públicos. Nenhum workflow publica na Cloudflare automaticamente.

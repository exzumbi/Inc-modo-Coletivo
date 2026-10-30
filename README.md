# Incômodo Coletivo — site estático no Cloudflare Workers

URL existente: https://inc-modo-coletivo.brunamara-mkt.workers.dev

Branch de produção: `producao-cloudflare-pages` (nome preservado). O site continua no **Worker existente** `inc-modo-coletivo`; não é necessário criar Pages, migrar plataforma ou configurar CMS/banco.

## Build e entrega dos arquivos

`npm ci` instala as ferramentas de desenvolvimento. `npm run build` gera `public/` a partir de `site/` e verifica links, imagens, contatos e ausência de código privado. `wrangler.jsonc` configura **Workers Static Assets** para publicar **somente `./public`** na raiz do domínio. Não há script de Worker interceptando assets, servidor Node em produção ou fallback de SPA.

- CSS: `/assets/site.css` → `text/css`.
- JavaScript: `/assets/public-preview.js` e `/assets/site-interactions.mjs` → JavaScript.
- Logos e imagens: `/assets/image-*.png` → `image/png`.
- Páginas: diretórios com `index.html`, com tratamento de barra final.
- URLs antigas com `/Inc-modo-Coletivo/` têm redirecionamentos explícitos para arquivos/páginas conhecidos da raiz. O HTML novo não depende desse prefixo.
- Arquivos inexistentes e rotas antigas do admin retornam404. Não retornar a home em lugar de CSS, JavaScript ou imagens ausentes.
- A interface usa fontes de sistema. Não há arquivo de fonte externa necessário para renderizar este layout; fontes Agrandir não foram adicionadas.

`npm run deploy` chama `wrangler deploy`. O próprio Wrangler executa `npm run build` antes de publicar, evitando enviar um `public/` antigo ou inexistente. O build usa por padrão o domínio Workers existente para canonical, sitemap e compartilhamento; `SITE_URL` pode substituí-lo futuramente por domínio próprio autorizado. Sem registrar ou comprar domínio automaticamente.

## Configuração do deploy automático no Worker existente

Na Cloudflare: **Workers & Pages → inc-modo-coletivo → Settings → Builds**. A conexão Git deve usar o repositório `exzumbi/Inc-modo-Coletivo` e a branch de produção **`producao-cloudflare-pages`**.

| Campo                           | Valor                              |
| ------------------------------- | ---------------------------------- |
| Root directory / diretório raiz | raiz do repositório (vazio ou `/`) |
| Build command                   | `npm run build`                    |
| Deploy command                  | `npx wrangler deploy`              |
| Production branch               | `producao-cloudflare-pages`        |

Se o comando atual contiver `--assets` apontando para outra pasta, remover essa opção: o `wrangler.jsonc` é a fonte de configuração. Não usar `--assets=.` ou `--assets=site`, nem comandos Vercel/Next-on-Pages. No Workers Builds não escolher a pasta `site/` como raiz do repositório. Manter deploy automático habilitado e executar novo deployment do commit corrigido. Não criar outro Worker e não alterar o GitHub Pages anterior.

## Verificação

- `npm test`: valida arquivos de origem e links.
- `npm run build`: gera os arquivos públicos.
- `npm run test:worker`: inicia Wrangler local com a configuração real e verifica HTTP, tipos de conteúdo, igualdade de bytes dos assets, páginas, redirecionamentos, metadados e rotas inexistentes/privadas. Não se autentica nem publica na Cloudflare.
- O GitHub Actions executa essas verificações em cada push/PR desta branch. Depois do deploy, `/release.json` informa versão1.0.1 e o commit quando fornecido por Workers Builds.

Se o HTML publicado ainda pedir `/Inc-modo-Coletivo/assets/...`, a publicação ainda é a versão antiga. Conferir a branch/commit do Worker e executar novo deploy. Publicação só está validada depois de verificar o endereço externo, imagens, MIME, vinil e celular; aprovação no GitHub sozinha não comprova isso.

## Preservação e edição

Logos, vinil, animações, conteúdo e responsividade estão em `site/`. A aplicação completa e o Backstage permanecem preservados no ambiente e em backup privado; não são incluídos nesta branch ou no Worker. Os contatos são WhatsApp e e-mail oficiais. Não há CRM, CMS, banco ou envio automático de mensagens.

Edite arquivos em `site/`, não `public/`. O deploy automático do Worker usa os commits desta branch. `public/`, `node_modules/`, `.wrangler/` e arquivos `.env` não são versionados. Nunca adicionar banco, anexos privados, credenciais ou backups.

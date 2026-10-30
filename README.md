# Incômodo Coletivo — Cloudflare Pages

Esta branch é **somente o site público estático**, preservando logos oficiais, vinil e animações. Não contém Next.js em produção, banco, CRM, CMS, Backstage ou credenciais. A aplicação completa continua preservada no ambiente original e em backup privado.

## Publicar uma vez

Na Cloudflare: **Workers & Pages → Create application → Pages → Connect to Git**. Se a tela abrir no fluxo de Workers, selecione a opção de criar **Pages**, não um Worker. Escolha `exzumbi/Inc-modo-Coletivo` e use:

| Campo                  | Valor                       |
| ---------------------- | --------------------------- |
| Production branch      | `producao-cloudflare-pages` |
| Framework preset       | `None`                      |
| Build command          | `npm run build`             |
| Build output directory | `public`                    |
| Root directory         | vazio (raiz do repositório) |

Clique **Save and Deploy**. O plano Pages gratuito basta; não há Functions/Workers pagos ou banco. Não adicionar comandos de deploy Vercel, Next-on-Pages ou Wrangler Workers. O nome do projeto determina o endereço `*.pages.dev`; não há URL publicada presumida neste README.

A integração Git configurará atualizações automáticas desta branch. Confirmar que os deployments automáticos da branch de produção continuam habilitados em Settings → Builds & deployments. Não mudar a branch da prévia antiga do GitHub Pages. Se já houver projeto Pages para este repositório, ajustar os mesmos campos nele e executar um novo deployment, em vez de criar um projeto duplicado.

## Como funciona

Os arquivos de conteúdo publicados estão em `site/`. `npm run build` verifica links/imagens/contatos e gera exclusivamente `public/`, que é enviado à Cloudflare. Não há dependências npm de produção. O Node é usado apenas durante o build, não há servidor contínuo. `.node-version` fixa a linha22 para o build.

`npm test` valida os arquivos sem gerar saída. O GitHub Actions executa a verificação a cada push ou PR desta branch; o build da Cloudflare faz a mesma verificação antes de publicar. Não precisa cadastrar tokens no GitHub para usar a integração Pages já conectada.

`CF_PAGES_URL`, fornecido pela Cloudflare, é usado para gerar canonical, compartilhamento, robots e sitemap para o endereço estável do projeto. Ao conectar domínio próprio futuramente, definir `SITE_URL=https://incomodocoletivo.com.br` em Production e republicar. Essa configuração não compra nem conecta o domínio por conta própria. Previews e testes locais não devem ser confundidos com publicação verificada.

Formulários foram substituídos por WhatsApp, com mensagens de serviço/parceria e e-mail oficial. Nenhum dado é enviado ou salvo neste site. Artigos demonstrativos e projeto conceitual permanecem identificados e fora do sitemap/indexação individual. A política de privacidade descreve essa versão estática. Os endereços antigos de artigos/projeto são preservados por redirecionamentos.

## Editar depois

Alterações em `site/` nesta branch, após commit/push, geram novo deploy automático. Não existe editor administrativo nesta fase. Para novas alterações visuais, usar PR e a prévia do Pages antes de integrar na branch de produção. Não editar `public/`: é uma pasta gerada. Não incluir `.data`, backups, anexos privados, senhas, tokens ou fontes da aplicação completa nesta branch.

O build publica `_headers` de segurança, redirecionamentos e uma página404 real para não responder com a home em rotas inexistentes. A saída não permite acesso ao antigo Backstage. Mensagens no WhatsApp exigem que o visitante confirme o envio no próprio WhatsApp; o site não envia mensagens automaticamente.

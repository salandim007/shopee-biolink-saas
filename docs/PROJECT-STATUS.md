# Shopee BioLink SaaS — Project Status

<!-- SHOPEE_PROJECT_STATUS -->

Última atualização: 2026-09-28

Este arquivo é a primeira leitura obrigatória ao retomar o projeto
em um novo chat ou sessão de desenvolvimento.

## Regra de retomada

Antes de alterar código:

1. Ler este arquivo.
2. Ler `docs/AI-PIPELINE.md`.
3. Executar:
   `git status`
4. Executar:
   `git log --oneline -10`
5. Somente depois decidir a próxima alteração.

Não reconstruir a arquitetura apenas pela memória dos chats.

---

## Ambiente principal

Projeto:
`/opt/shopee-biolink-saas`

Container:
`shopee-biolink`

Aplicação:
`127.0.0.1:3100 -> 3000`

Stack principal:
- Node.js
- Express
- EJS
- SQLite
- Docker Compose
- Shopee Affiliate API
- Meta/Facebook/Instagram

---

## Central de Produtos e Mídias

Rota:
`/admin/products-media`

API:
`/api/products-media`

API individual:
`/api/products-media/:itemId`

Aba:
`Avaliados pela IA`

### Correção 2026-09-28

Foi encontrado container rodando versão antiga de
`views/products-media.ejs`.

Correção realizada:
- `docker compose build shopee-biolink`
- recriação do container
- host e container passaram a ter o mesmo SHA256.

---

## Facebook

Página configurada:
`FACEBOOK_PAGE_ID=276518592780816`

O token da Página foi renovado em 2026-09-28 e carregado em:
`.env.production`

Variável:
`FACEBOOK_PAGE_ACCESS_TOKEN`

O token NÃO deve ser salvo em documentação ou Git.

Container confirmou:
- PAGE_ID carregado
- PAGE_TOKEN carregado

Endpoint de publicação:
`POST /admin/vitrine2/marketing/meta/publish`

Basic Auth validado.

Ainda falta concluir o teste real de publicação depois das correções
da Central/IA.

---

## IA — estado atual

Existem:

- `ai/product-analysis-store.js`
- `ai/product-score-store.js`
- `ai/product-agent.js`
- `ai/product-score-engine.js`
- `ai/content-orchestrator.js`
- `ai/content-generator.js`
- `ai/content-job-store.js`
- `ai/content-queue-store.js`
- `ai/run-product-analysis-batch.js`
- `ai/run-product-score-batch.js`
- `ai/run-content-jobs.js`
- `ai/run-nightly-content-prep.js`

### Problema encontrado

A implementação ainda contém uma barreira antiga de teste de
100 produtos.

Arquivos/trechos conhecidos:

`ai/run-product-analysis-batch.js`
- usa `listProducts({ limit: 100, offset: 0 })`
- possui totais/logs hardcoded em 100
- grava `product-analysis-100.jsonl`
- grava `product-analysis-100-status.json`

`ai/run-product-score-batch.js`
- grava `product-scores-100.json`
- usa `.slice(0, 100)`

`ai/product-analysis-store.js`
- lê `product-analysis-100.jsonl`

`ai/product-score-store.js`
- lê `product-scores-100.json`

`product-media-service.js`
- `listProducts()` limita qualquer consulta a no máximo 100.

Essa barreira deve ser removida com migração controlada.
Não simplesmente trocar nomes de arquivos.

---

## Correções IA feitas em 2026-09-28

Adicionada em `product-media-service.js`:

`hasProductByItemId(itemId)`

Objetivo:
verificar rapidamente se um produto ainda existe em `catalog.sqlite`.

Também adicionada:

`getExistingProductIds(itemIds)`

Objetivo:
verificar vários IDs de análise em lote sem percorrer o catálogo inteiro.

A rota:

`POST /api/ai/prepare/:itemId`

agora verifica a existência do produto antes de criar um job.

Produto inexistente retorna imediatamente HTTP 404 em vez de ficar
preso em "Aguardando processamento".

A rota:

`GET /api/ai/analyses`

passou a filtrar análises cujo produto não existe mais no catálogo ativo.

O histórico de análises NÃO deve ser apagado.

---

## Estado observado das análises

Arquivo piloto contém:
100 análises.

Após verificar contra o catálogo atual:
15 análises ainda correspondiam a produtos ativos.

O painel `/api/ai/summary` ainda conta o histórico piloto de 100
e precisa posteriormente ser alinhado ao conceito de catálogo ativo.

---

## Worker de conteúdo

`ai/run-content-jobs.js`

Processa jobs com status:
`QUEUED`

Fluxo:
QUEUED
-> PROCESSING
-> DONE ou FAILED

No momento foi constatado que o worker NÃO é iniciado automaticamente
quando o usuário cria um job pela Central.

Teste manual:

`docker exec -it shopee-biolink node ai/run-content-jobs.js`

Isso confirmou que o worker funciona.

Pendente:
automatizar o processamento sem execução manual.

---

## Sincronização atual

Cron existente:

`5 * * * * /opt/shopee-biolink-saas/run-hourly-sync.sh`

Atualmente `run-hourly-sync.sh` executa:

1. `vitrine2-product-sync-batch.js`
2. `meta-catalog-sync.py`

Ele NÃO executa atualmente:

`scripts/shopee-feed-delta-sync.js`

O delta oficial da Shopee já possui tratamento para:

- NEW
- UPDATE
- DELETE

e pode remover produtos do `catalog.sqlite`.

Ver `docs/AI-PIPELINE.md` antes de alterar essa rotina.

---

## Próximos passos

Ordem recomendada:

1. Finalizar documentação do pipeline.
2. Remover barreira piloto de 100 produtos.
3. Criar carga inicial completa e retomável.
4. Preservar análises já existentes.
5. Implementar atualização incremental.
6. Integrar NEW / UPDATE / DELETE / REACTIVATE.
7. Automatizar worker de conteúdo.
8. Integrar preparação noturna HIGH/MEDIUM.
9. Corrigir métricas/resumo da aba IA.
10. Retomar teste real de publicação Facebook.


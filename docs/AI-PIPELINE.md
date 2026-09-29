# Shopee BioLink SaaS — AI Pipeline

<!-- SHOPEE_AI_PIPELINE -->

Última atualização: 2026-09-28

Este documento define a arquitetura permanente do pipeline de
catálogo, análise, score e preparação de conteúdo.

Não alterar esse fluxo sem atualizar este documento.

---

# 1. PRINCÍPIO FUNDAMENTAL

O catálogo completo da Shopee, aproximadamente 100.000 produtos,
NÃO deve ser reprocessado diariamente pela IA.

A análise pesada do catálogo completo é uma CARGA INICIAL ÚNICA.

Depois disso, todo processamento deve ser INCREMENTAL.

---

# 2. CARGA INICIAL

Fluxo:

CATÁLOGO COMPLETO
    ↓
ANÁLISE IA
    ↓
SCORE
    ↓
BASE PERSISTENTE DE ANÁLISES
    ↓
SELEÇÃO DE OPORTUNIDADES
    ↓
HIGH / MEDIUM
    ↓
PREPARAÇÃO NOTURNA
    ↓
READY_FOR_APPROVAL

A carga inicial deve:

- poder ser interrompida;
- possuir checkpoint;
- continuar de onde parou;
- não reprocessar produtos concluídos;
- registrar falhas;
- permitir retentativa;
- não depender de terminal aberto.

---

# 3. PROCESSAMENTO INCREMENTAL

Após a carga inicial, NÃO analisar novamente todos os produtos.

A origem das mudanças deve ser o delta da Shopee.

Eventos:

## NEW

Produto novo.

Ações:
- inserir no catálogo;
- marcar como pendente de análise;
- analisar;
- calcular score;
- tornar candidato à preparação noturna.

## UPDATE

Produto alterado.

Nem toda alteração exige nova IA.

Mudanças relevantes podem incluir:
- preço;
- comissão;
- vendas;
- avaliação;
- disponibilidade;
- mídia;
- categoria;
- outras informações usadas pelo score/análise.

Quando relevante:
- marcar análise como desatualizada;
- recalcular;
- preservar histórico anterior.

## DELETE

Produto não disponível.

NÃO apagar o histórico comercial/IA.

Marcar como:
`INACTIVE` ou `OFF`

Produto não deve:
- aparecer como oportunidade ativa;
- entrar em nova preparação;
- ser publicado automaticamente.

## REACTIVATE

Produto anteriormente OFF voltou ao catálogo.

Reaproveitar análise anterior quando ainda válida.

Reavaliar somente quando dados relevantes tiverem mudado.

---

# 4. ESTADOS CONCEITUAIS

Estados recomendados do produto/pipeline:

`NEW`
Produto nunca processado.

`PENDING_ANALYSIS`
Aguardando IA.

`ANALYZED`
Análise disponível.

`SCORED`
Score disponível.

`ACTIVE`
Produto disponível no catálogo.

`INACTIVE` / `OFF`
Produto temporariamente indisponível.

`DIRTY` / `UPDATED`
Dados relevantes mudaram e exigem nova avaliação.

`READY_FOR_APPROVAL`
Conteúdo preparado para aprovação humana.

`APPROVED`
Conteúdo aprovado.

`PUBLISHED`
Conteúdo publicado.

---

# 5. ROTINA NOTURNA

Script existente:

`ai/run-nightly-content-prep.js`

Regra:

1. Processar HIGH.
2. Depois processar MEDIUM.
3. LOW não entra na pré-geração normal.
4. Não preparar novamente conteúdo válido.
5. Resultado permanece salvo para uso durante o dia.

Canais atualmente contemplados pelo script:
- facebook
- instagram

Estado esperado:
`READY_FOR_APPROVAL`

Nada deve ser publicado sem a regra de aprovação configurada.

---

# 6. DURANTE O DIA

A Central NÃO deve fazer o usuário esperar a IA gerar tudo do zero.

Fluxo esperado:

produto
→ análise pronta
→ score pronto
→ conteúdo pré-gerado quando aplicável
→ usuário revisa
→ aprova/refaz
→ publica/agendar

Botão `Refazer conteúdo` deve gerar nova versão sem destruir
a anterior antes da nova geração terminar com sucesso.

---

# 7. ARQUIVOS ATUAIS

Análise:
`ai/run-product-analysis-batch.js`

Store:
`ai/product-analysis-store.js`

Score:
`ai/run-product-score-batch.js`
`ai/product-score-store.js`
`ai/product-score-engine.js`

Conteúdo:
`ai/content-orchestrator.js`
`ai/content-generator.js`
`ai/content-job-store.js`
`ai/content-queue-store.js`

Worker:
`ai/run-content-jobs.js`

Noturno:
`ai/run-nightly-content-prep.js`

Catálogo:
`product-media-service.js`

Delta Shopee:
`scripts/shopee-feed-delta-sync.js`

Full Shopee:
`scripts/shopee-feed-full-sync.js`

Banco:
`/app/data/shopee-feed-api/index/catalog.sqlite`

---

# 8. BARREIRA PILOTO DE 100 — REMOVER

Estado encontrado em 2026-09-28:

`ai/run-product-analysis-batch.js`

usa:
`listProducts({ limit: 100, offset: 0 })`

e possui contadores hardcoded:
`100`

Arquivos:
`product-analysis-100.jsonl`
`product-analysis-100-status.json`

`ai/run-product-score-batch.js`

usa:
`.slice(0, 100)`

Arquivo:
`product-scores-100.json`

Stores também apontam para esses arquivos.

Além disso:

`product-media-service.js::listProducts()`

possui teto:
`Math.min(..., 100)`

IMPORTANTE:

Esse limite de 100 fazia parte do piloto.

Ele NÃO representa a arquitetura final.

A remoção deve preservar dados existentes e implementar paginação/
checkpoint. Não carregar 100.000 objetos simultaneamente em memória
sem necessidade.

---

# 9. CATÁLOGO E DELTA

`scripts/shopee-feed-delta-sync.js`

já reconhece:

`NEW`
`UPDATE`
`DELETE`

DELETE atualmente possui:

`DELETE FROM products WHERE itemid = ?`

A arquitetura futura deve decidir se o catálogo ativo remove a linha
enquanto uma base histórica separada mantém o estado OFF, ou se o
estado é preservado diretamente em uma camada de histórico.

Regra obrigatória:
histórico de IA não deve desaparecer apenas porque o produto ficou OFF.

---

# 10. AGENDAMENTOS

Cron conhecido em 2026-09-28:

`5 * * * * /opt/shopee-biolink-saas/run-hourly-sync.sh`

Esse script atualmente executa:

- sincronização Vitrine 2;
- geração do feed Meta.

Ele NÃO chama o delta oficial do catálogo.

A rotina noturna de IA ainda precisa ser integrada ao agendamento
de produção.

---

# 11. WORKER

`ai/run-content-jobs.js`

busca:
`status === 'QUEUED'`

e processa sequencialmente.

Estados:
`QUEUED`
→ `PROCESSING`
→ `DONE`

ou:
→ `FAILED`

Em 2026-09-28 foi confirmado que a criação do job pela API não inicia
automaticamente esse worker.

Isso deve ser corrigido antes de considerar o pipeline automatizado.

---

# 12. COMANDOS DE DIAGNÓSTICO

Ler documentação:

`cat docs/PROJECT-STATUS.md`
`cat docs/AI-PIPELINE.md`

Localizar arquitetura:

`grep -Rni "SHOPEE_AI_PIPELINE" docs ai scripts`

Localizar antigas barreiras piloto:

`grep -RniE "product-analysis-100|product-scores-100|slice\(0,[[:space:]]*100\)" ai`

Status Git:

`git status`

Últimos commits:

`git log --oneline -10`

Container:

`docker compose ps`

Logs:

`docker logs --since 10m shopee-biolink`

---

# 13. REGRA PARA FUTUROS CHATS

Ao iniciar novo chat relacionado ao Shopee BioLink SaaS:

LER PRIMEIRO:

1. `docs/PROJECT-STATUS.md`
2. `docs/AI-PIPELINE.md`
3. `git status`
4. `git log --oneline -10`

Somente depois investigar código ou propor mudanças.

A documentação do repositório é a fonte principal de continuidade
do projeto.


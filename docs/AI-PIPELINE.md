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



---

## Processamento noturno automático — 2026-09-29

Wrapper:

`/opt/shopee-biolink-saas/run-nightly-ai.sh`

Cron instalado:

`20 * * * * /usr/bin/flock -n /tmp/shopee-ai-nightly.lock /opt/shopee-biolink-saas/run-nightly-ai.sh >> /opt/shopee-biolink-saas/tmp/ai-nightly.log 2>&1`

O wrapper interpreta o horário usando:

`America/Sao_Paulo`

Regra:

- antes das 02:00: não executa;
- a primeira chamada elegível ocorre às 02:20;
- executa no máximo uma preparação concluída por dia;
- usa arquivo de controle:
  `data/ai/nightly-last-success-date`;
- em falha geral, não grava sucesso e poderá tentar novamente na hora seguinte;
- usa `flock` para evitar duas execuções simultâneas.

Preparação:

HIGH primeiro.
MEDIUM depois.
LOW normalmente não recebe pré-geração.

Regra de resiliência:

Falha local, impacto local.

Se uma etapa de IA falhar:
- timeout por chamada configurado em 20 segundos;
- entra fallback;
- não continua tentando outras estações de IA naquele produto;
- fallback TITLE_ONLY;
- salva conteúdo mínimo;
- segue o fluxo.

Uma falha de produto/canal não deve interromper todo o processamento noturno.

IMPORTANTE:

Este processo noturno opera sobre os produtos já analisados/classificados
disponíveis no score store atual.

Ele NÃO representa a futura carga inicial dos aproximadamente 100 mil
produtos.

A carga inicial de grande volume continua sendo:
uma única carga completa + processamento incremental posterior.

---

## Atualização 2026-10-01 — janela noturna e continuidade da fila

### Janela oficial

`run-nightly-ai.sh` usa explicitamente:

`America/Sao_Paulo`

O cron continua acionando o wrapper no minuto 20 de cada hora:

`20 * * * *`

Porém o processamento só pode ocorrer entre:

`02:00 e 06:59` no horário de São Paulo.

Regras:

- fora da janela: encerra sem processar;
- primeira tentativa normal: 02:20;
- em falha geral: nova tentativa na hora seguinte dentro da janela;
- em sucesso: grava `data/ai/nightly-last-success-date`;
- não repete uma preparação já concluída no mesmo dia;
- `flock` impede execuções concorrentes.

Isso evita depender do fuso horário da VPS.

### Regra obrigatória de resiliência

A IA não pode deixar a fila parada.

Fluxo:

IA disponível
→ conteúdo normal

IA indisponível ou timeout
→ fallback local
→ `TITLE_ONLY`
→ conteúdo mínimo seguro
→ `READY_FOR_APPROVAL`

### Produto ausente do catálogo

`ai/content-orchestrator.js` agora possui fallback adicional.

Quando `product-media-service.getProductByItemId()` não encontra mais o
produto, o sistema consulta `product-score-store`.

Se houver score salvo, recupera dados mínimos como:

- itemId;
- shopId;
- title;
- image;
- vendas;
- avaliações;
- contagem conhecida de mídias.

O processamento continua usando esses dados.

Fluxo validado:

produto ausente do catálogo
→ dados recuperados do scoreStore
→ tentativa da IA
→ timeout da IA
→ fallback `TITLE_ONLY`
→ `READY_FOR_APPROVAL`.

Teste validado com o item:

`58204541678`

Mesmo com produto ausente do catálogo atual e timeout do provedor de IA,
a preparação terminou com `success: true` e criou item
`READY_FOR_APPROVAL`.

Regra permanente:

falha de IA ou ausência temporária do produto no catálogo não deve deixar
o item preso em `PROCESSING`.

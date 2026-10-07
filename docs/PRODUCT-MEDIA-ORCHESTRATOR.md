# Product Media Orchestrator

## Objetivo

Fornecer um único ponto de acesso às mídias dos produtos,
independentemente do marketplace.

A Central de Produção de Vídeo não deve conhecer detalhes de
Shopee, SQLite, navegador, feed, CSV ou captura.

Ela deve chamar apenas o orquestrador.

## Arquitetura

Central de Produção
→ product-media-orchestrator.js
→ provider do marketplace
→ acervo persistente
→ fallback do provider quando necessário

## Provider Shopee

Arquivo:

product-media-providers/shopee.js

Fluxo:

1. Resolve o link e identifica itemId/shopId.
2. Consulta primeiro o acervo persistente.
3. Se necessário, complementa pelo catalog.sqlite.
4. Se ainda houver poucas imagens, executa captura Shopee.
5. Novas mídias são mescladas e persistidas no acervo.
6. Retorna resposta única para a aplicação.

## Fonte persistente

O acervo utiliza o mesmo catálogo persistente já usado pela
Vitrine 2:

data/vitrine2-catalog.json

A persistência é feita através de:

product-catalog-store.js
product-media-library.js

Não deve ser criado um segundo banco de mídias paralelo.

## Quantidade padrão

A Produção de Vídeo solicita inicialmente 5 imagens.

O provider pode retornar mais imagens; a tela decide quais serão
selecionadas para o vídeo.

## Falhas

Falha no enriquecimento não deve apagar mídias já existentes.

Se houver imagens no acervo/feed, elas continuam disponíveis e
a resposta inclui warnings sobre o fallback que falhou.

## Novos marketplaces

Para Samsung, Amazon, Mercado Livre, Magalu ou outros:

1. criar novo provider;
2. implementar canHandle();
3. implementar getProductMedia();
4. registrar o provider no orquestrador.

A Central de Produção não deve precisar ser alterada.

## Regra arquitetural

A Central de Produção nunca deve acessar diretamente:

- catalog.sqlite
- navegador Chrome
- captura Shopee
- CSV/feed específico de marketplace

Esses detalhes pertencem aos providers e ao orquestrador.

## Teste sem captura

É possível testar com:

getProductMedia({
    url: '<link>',
    minImages: 5,
    enrich: false
})

Assim apenas acervo/feed são consultados.

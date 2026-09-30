# SHOPEE_MEDIA_PIPELINE

Última atualização: 2026-09-29

Este documento registra a arquitetura real e atual das mídias
do projeto Shopee BioLink SaaS.

Objetivo: evitar retrabalho e impedir que novos chats assumam
arquiteturas antigas que já não representam o fluxo da Central
de Produtos e Mídias.

---

## 1. REGRA PRINCIPAL

A Central de Produtos e Mídias NÃO usa atualmente o Chrome
como fonte principal de imagens.

O fluxo atual confirmado é:

Shopee Data Feed
    ↓
catalog.sqlite
    ↓
product-media-service.js
    ↓
Central de Produtos e Mídias
    ↓
Tap-to-Post

---

## 2. FONTE ATUAL DAS IMAGENS

Banco:

data/shopee-feed-api/index/catalog.sqlite

Tabela:

products

Colunas de mídia confirmadas:

- image_link
- image_link_3

Não existem atualmente no catálogo outras colunas de imagem
nem campos de vídeo.

Campos relacionados encontrados:

- description
- image_link
- image_link_3
- model_ids
- model_names
- product_link
- product_short_link

---

## 3. PRODUCT MEDIA SERVICE

Arquivo:

product-media-service.js

O serviço atual monta a coleção de imagens usando:

- row.image_link
- row.image_link_3

Estrutura retornada:

- image
- images[]
- video
- videos[]
- media.image
- media.images[]
- media.video
- media.videos[]
- media.imageCount
- media.videoCount
- media.source

A origem atual aparece como:

shopee_catalog_feed

Consequência:

Pelo fluxo atual do catálogo, um produto possui no máximo
2 imagens distintas quando somente image_link e image_link_3
estão disponíveis.

Se a Central mostrar somente duas fotos, isso NÃO significa
que a interface possui limite de duas fotos.

Significa que a fonte atual entregou somente duas.

---

## 4. PRODUCT FEED MEDIA RESOLVER

Arquivo:

product-feed-media-resolver.js

O resolver atual também usa exclusivamente:

- row.image_link
- row.image_link_3

Ele retorna:

- images[]
- video: null
- videos: []

Portanto ele não é atualmente uma fonte de galeria expandida.

---

## 5. PRODUCT MEDIA LIBRARY

Arquivo:

product-media-library.js

Esta camada suporta:

- múltiplas imagens
- múltiplos vídeos
- merge de listas
- deduplicação
- persistência
- verificação de quantidade mínima
- enriquecimento de mídia

Ela representa a camada apropriada para armazenar/enriquecer
uma biblioteca maior de mídias.

IMPORTANTE:

A existência dessa biblioteca NÃO significa que a Central
esteja recebendo atualmente várias imagens através dela.

O fluxo atual confirmado da Central continua vindo do
catalog.sqlite através do product-media-service.js.

---

## 6. CHROME / CAPTURA ANTIGA

Arquivos ainda existentes:

- shopee-browser-media-capture.js
- marketing-routes.js

Ainda existe uma rota antiga:

/media/gallery

E marketing-routes.js ainda possui referência a:

captureShopeeMedia

Histórico:

Em fases anteriores foram realizados testes de captura de várias
imagens e vídeo através de navegador.

Esses testes provaram que a Shopee possui mais mídias do que as
duas URLs existentes no Data Feed atual.

Porém:

O navegador/Chrome NÃO é atualmente a arquitetura principal
que alimenta a Central de Produtos.

NÃO restaurar ou transformar Chrome novamente na fonte principal
sem uma decisão arquitetural explícita.

Código antigo pode continuar presente por compatibilidade,
teste ou fallback.

---

## 7. INTERFACE DA CENTRAL

A interface atual do Tap-to-Post aceita várias imagens.

Ela combina e deduplica fontes como:

- produto.media.images
- produto.images
- produto.image
- produto.media.image

Portanto a interface NÃO é o gargalo das duas fotos.

Se o backend fornecer 5, 10 ou mais URLs válidas,
a galeria foi desenhada para trabalhar com múltiplas imagens.

---

## 8. DIAGNÓSTICO CONFIRMADO EM 2026-09-29

Produto testado:

itemId: 58266131453

Título:

Camera IP Dome 5MP AITEK SEG6050BP POE Visao Noturna
Colorida Inteligencia Artificial IA Audio

Resultado real retornado pelo product-media-service:

imageCount: 2
videoCount: 0
source: shopee_catalog_feed

Imagens:

1. image_link
2. image_link_3

Conclusão:

O motivo de aparecerem somente duas imagens é a limitação
da fonte de dados atual.

Não é um limite da interface.

---

## 9. PRÓXIMO PASSO PARA MÚLTIPLAS MÍDIAS

Não alterar a interface primeiro.

O próximo trabalho deve descobrir/implementar uma fonte de
enriquecimento que alimente product-media-library.js com:

- fotos adicionais reais do produto
- vídeos reais quando disponíveis
- identificação itemId/shopId
- deduplicação
- persistência
- reutilização posterior sem nova captura desnecessária

A arquitetura desejada é:

Catálogo
    ↓
produto base
    ↓
camada de enriquecimento de mídia
    ↓
product-media-library
    ↓
product-media-service / Central
    ↓
Tap-to-Post

A fonte de enriquecimento deve ser definida antes de qualquer
nova implementação.

---

## 10. REGRA PARA NOVOS CHATS

Antes de investigar problemas relacionados a fotos, vídeos,
galeria, Tap-to-Post ou captura da Shopee:

1. Ler docs/PROJECT-STATUS.md
2. Ler docs/AI-PIPELINE.md
3. Ler docs/MEDIA-PIPELINE.md
4. Verificar git status
5. Verificar git log --oneline -10

Nunca assumir que Chrome é a fonte atual da Central.

Nunca assumir que duas fotos representam um limite da UI.

Marcador pesquisável:

SHOPEE_MEDIA_PIPELINE

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


---

## 11. TRANSIÇÃO CONFIRMADA — 17/09 → 23/09/2026

Em 17/09/2026 o projeto possuía fluxo de captura de múltiplas
mídias capaz de trabalhar com várias imagens e vídeo.

Esse fluxo dependia da captura da página/sessão da Shopee.

Em 23/09/2026 a arquitetura principal da Central foi alterada.

O Chrome/Puppeteer deixou de ser a fonte principal da nova Central.

A nova arquitetura passou a usar:

Shopee Data Feed oficial
→ FULL / DELTA
→ catalog.sqlite
→ product-media-service.js
→ Central de Produtos

Essa migração resolveu a dependência do navegador para o catálogo,
mas NÃO substituiu a antiga fonte de galeria completa.

O Data Feed atual fornece somente:

- image_link
- image_link_3

A Affiliate Open API productOfferV2 fornece:

- imageUrl

Não existe atualmente uma fonte NÃO-Chrome já validada e integrada
que forneça 5 a 15 imagens reais por produto.

Portanto:

- catálogo/sincronização oficial: CONCLUÍDO;
- até 2 imagens pelo feed: CONCLUÍDO;
- interface para múltiplas imagens: CONCLUÍDA;
- product-media-library preparada: CONCLUÍDA;
- nova fonte automática de múltiplas mídias sem Chrome: PENDENTE.

REGRA:

Não repetir investigação sobre por que aparecem somente 2 imagens.
A causa já está confirmada.

Não voltar ao Chrome/Puppeteer como arquitetura principal.

O próximo trabalho de mídia deve começar diretamente pela criação
ou integração da camada de enriquecimento de múltiplas mídias.

Marcador:

SHOPEE_MEDIA_ENRICHMENT_PENDING

---

## Atualização 2026-10-01 — captura complementar de múltiplas mídias

O Data Feed e o `catalog.sqlite` continuam sendo a fonte base do produto.

A Central agora possui também uma camada complementar de enriquecimento:

Data Feed
→ catalog.sqlite
→ product-media-service
→ produto base
→ `/admin/vitrine2/marketing/media/gallery`
→ `shopee-browser-media-capture.js`
→ Chromium persistente autenticado
→ merge/deduplicação
→ Central / Tap-to-Post

O Chromium NÃO substitui o catálogo principal. Ele complementa as mídias
disponíveis para preparação e publicação.

### Chromium persistente

Inicialização:

`scripts/start-app.sh`

Configuração principal:

- Xvfb em `DISPLAY=:99`;
- Chromium com remote debugging em `127.0.0.1:9222`;
- perfil no container:
  `/app/data/chrome-shopee-persistent`;
- perfil persistente no host:
  `./data/chrome-shopee-persistent-host`.

O perfil contém sessão/cookies da Shopee e deve permanecer protegido por:

- `.gitignore`;
- `.dockerignore`.

Nunca versionar o perfil autenticado.

`shopee-browser-media-capture.js` conecta ao navegador existente usando
`puppeteer.connect()` e usa `browser.disconnect()` ao final, sem fechar o
Chromium persistente.

Não forçar User-Agent artificial. O teste de 2026-09-30 mostrou que isso
interferia na captura correta da página da Shopee.

### Resultado validado

Em 2026-10-01 foi validado:

produto com imagens básicas do catálogo
→ captura adicional da página real da Shopee
→ merge das imagens
→ Central exibindo múltiplas fotos
→ Tap-to-Post reutilizando a galeria
→ escolha manual da foto de capa.

A quantidade de fotos varia por produto.

Ainda podem aparecer algumas imagens promocionais/secundárias existentes
na página da Shopee. Esse filtro poderá ser refinado posteriormente sem
alterar a arquitetura validada.

## Facebook Groups via compartilhamento nativo

Validado em 2026-10-01 no Android.

Fluxo adotado para publicação em grupos:

1. O produto é aberto em `Pronto para postar`.
2. O usuário escolhe a foto de capa.
3. O botão `Compartilhar em Grupos` usa `navigator.share()`.
4. Antes de abrir o compartilhamento nativo, o SaaS copia automaticamente
   `window.tapFacebookShare.legenda` para a área de transferência.
5. `share.legenda` já contém a chamada comercial e o link afiliado Shopee.
6. O usuário escolhe Facebook e os grupos desejados.
7. Na tela final de edição do Facebook, usa `Colar`.
8. O Facebook publica a foto e a legenda; o link Shopee colado fica clicável.

Observações importantes:

- A foto compartilhada como arquivo não é, por si só, clicável para a Shopee.
- O link clicável fica na legenda colada no editor do Facebook.
- O Facebook pode ignorar `text` e `url` quando uma imagem é compartilhada
  como arquivo; por isso o clipboard é o caminho validado.
- O botão `Publicar na Página do Facebook` continua separado e usa a API Meta.
- A automação completa da interface do Facebook fica como plano futuro.


---

## 10. RECUPERAÇÃO DA GALERIA SHOPEE — VALIDADO EM 2026-10-08

### Estado atual validado

A Central de Produção de Vídeo usa:

Central
→ /api/product-media
→ product-media-orchestrator
→ product-media-providers/shopee.js
→ product-media-library
→ enriquecimento por captura quando necessário

Regra atual:

- minImages: 5
- enrich: true
- acervo existente é reutilizado
- se houver poucas imagens, o provider tenta enriquecimento
- imagens capturadas são persistidas para reutilização

### Chrome persistente

O capturador conecta em:

http://127.0.0.1:9222

O Chrome usa:

/app/data/chrome-shopee-persistent

Ambiente gráfico:

DISPLAY=:99
Xvfb :99

O capturador usa puppeteer.connect().
NÃO substituir por puppeteer.launch() sem necessidade.

### Sintoma de sessão Shopee inválida

Mesmo havendo cookies, a sessão pode estar expirada.

Sintomas confirmados:

- /verify/traffic/error
- is_logged_in=false
- get_account_info retorna error: 19
- get_pc pode retornar HTTP 200 com payload de erro 90309999
- captura retorna blocked: true
- images: []

Isso significa problema de sessão/autenticação,
não problema de filtro de imagens nem da interface.

### Recuperação visual da sessão

Se necessário, acessar o mesmo Chrome persistente por Xvfb.

Instalar temporariamente no container:

x11vnc
novnc
websockify

Subir VNC na tela existente:

DISPLAY=:99 x11vnc \
  -display :99 \
  -localhost \
  -forever \
  -shared \
  -nopw \
  -rfbport 5900

Subir noVNC:

websockify \
  --web=/usr/share/novnc \
  6080 \
  localhost:5900

O container pode possuir mais de uma rede Docker.
NÃO concatenar os IPs.

Listar corretamente:

docker inspect \
  -f '{{range $name,$net := .NetworkSettings.Networks}}{{printf "%s -> %s\n" $name $net.IPAddress}}{{end}}' \
  "$(docker compose ps -q shopee-biolink)"

Criar túnel SSH no Windows usando um IP válido do container:

ssh -N -L 6080:IP_DO_CONTAINER:6080 admin@IP_DA_VPS

Abrir:

http://127.0.0.1:6080/vnc.html

Fazer login normalmente na Shopee no Chromium exibido.
A sessão ficará no perfil persistente.

### Teste decisivo do capturador

Produto validado:

shopId: 654040744
itemId: 23899039241

Após restaurar a sessão:

blocked: false
imageCount: 15

### Teste decisivo do provider

getProductMedia({
  url,
  minImages: 5,
  enrich: true
})

Resultado validado:

imageCount: 16
hasEnoughImages: true
needsEnrichment: false
captureAttempted: true
captured: true
warnings: []

### Resultado final na Central

A Central voltou a mostrar 16 fotos reais.

As primeiras 5 são selecionadas inicialmente para o vídeo,
mas productPhotos mantém toda a galeria disponível.

### Ordem correta de diagnóstico

Se as fotos sumirem novamente:

1. NÃO alterar primeiro a interface.
2. Testar captureShopeeMedia().
3. Verificar blocked e finalUrl.
4. Se bloqueado, testar sessão Shopee.
5. Restaurar login no Chrome persistente se necessário.
6. Testar getProductMedia().
7. Somente se o provider devolver várias fotos e a Central não,
   investigar rota/frontend.
8. NÃO alterar filtros de imagem sem evidência.


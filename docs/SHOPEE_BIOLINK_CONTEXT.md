\# Shopee BioLink SaaS — Contexto Oficial do Projeto

\## Regra básica de continuidade

Este arquivo é a fonte oficial de continuidade do projeto Shopee BioLink SaaS.

Em todo novo chat ou nova sessão de desenvolvimento:

1\. Ler este arquivo antes de investigar novamente a arquitetura.

2\. Continuar a partir da seção "Próximo passo exato".

3\. Atualizar este documento sempre que houver:

&#x20;  - alteração importante de arquitetura;

&#x20;  - nova integração;

&#x20;  - novo script;

&#x20;  - mudança de fluxo;

&#x20;  - novo commit estável;

&#x20;  - decisão de produto;

&#x20;  - teste importante validado.

4\. Antes de encerrar uma etapa importante ou trocar de chat:

&#x20;  - atualizar este documento;

&#x20;  - validar;

&#x20;  - fazer commit;

&#x20;  - fazer push.

A finalidade é evitar reinvestigação e perda de contexto entre chats.

\---

\# Estado atual

Data de referência: 25/08/2026.

Branch principal:

main

Último commit estável:

3635ec3 — Add automatic Vitrine 2 API importer

Commit anterior relevante:

dcbe2de — Add Shopee product pagination and affiliate URL support

Commit anterior:

23c0b86 — Handle temporary failures in Vitrine 2 sync

\---

\# Objetivo do projeto

Criar um SaaS de Link na Bio / mini vitrine para afiliados Shopee.

Prioridade atual:

Vitrine 2 como MVP funcional, profissional e monetizável.

A Vitrine 1 não deve ser alterada durante o desenvolvimento da Vitrine 2.

\---

\# Metodologia de desenvolvimento

Regra de trabalho adotada:

\- um arquivo por vez;

\- informar caminho exato do arquivo;

\- preferir conteúdo completo quando a alteração for extensa;

\- validar sintaxe antes de testar;

\- testar funcionamento real antes de commit;

\- commit somente depois da validação;

\- não alterar visual aprovado da Vitrine 2 sem necessidade;

\- não mexer na Vitrine 1;

\- manter este documento atualizado.

\---

\# Ambiente local

Projeto:

C:\\Users\\Douglas\\App Shopee\\shopee-biolink-saas

Stack principal:

\- Node.js

\- Express

\- EJS

\- SQLite

\- PowerShell

\- Shopee Affiliate Open API

\- CSV/Data Feed como fonte complementar

Servidor local:

http://localhost:3000

Vitrine pública:

http://localhost:3000/vitrine2

Admin Vitrine 2:

http://localhost:3000/admin/vitrine2

\---

\# Credenciais Shopee

As credenciais estão salvas como variáveis de ambiente do usuário do Windows.

Variáveis:

SHOPEE\_AFFILIATE\_APP\_ID

SHOPEE\_AFFILIATE\_SECRET

Quando um novo PowerShell não enxergar as variáveis, carregar com:

$env:SHOPEE\_AFFILIATE\_APP\_ID = \[Environment]::GetEnvironmentVariable("SHOPEE\_AFFILIATE\_APP\_ID", "User")

$env:SHOPEE\_AFFILIATE\_SECRET = \[Environment]::GetEnvironmentVariable("SHOPEE\_AFFILIATE\_SECRET", "User")

Nunca registrar os valores das credenciais neste documento ou no Git.

\---

\# Shopee Affiliate Open API

Endpoint Brasil:

https://open-api.affiliate.shopee.com.br/graphql

Autenticação:

Authorization:

SHA256 Credential={AppId}, Timestamp={Timestamp}, Signature={Signature}

Assinatura:

SHA256(AppId + Timestamp + Payload + Secret)

Operação principal atualmente usada:

productOfferV2

\---

\# productOfferV2

Argumentos confirmados pelo próprio schema GraphQL:

\- listType

\- matchId

\- keyword

\- sortType

\- page

\- limit

\- itemId

\- shopId

\- productCatId

\- isAMSOffer

\- isKeySeller

Paginação confirmada:

page + limit

scrollId não é argumento de entrada de productOfferV2.

Teste validado:

page 1 e page 2 retornaram produtos diferentes.

\---

\# Campos disponíveis em ProductOfferV2

Introspecção GraphQL confirmou:

\- itemId

\- commissionRate

\- appExistRate

\- appNewRate

\- webExistRate

\- webNewRate

\- commission

\- price

\- sales

\- imageUrl

\- productName

\- shopName

\- productLink

\- offerLink

\- periodEndTime

\- periodStartTime

\- priceMin

\- priceMax

\- productCatIds

\- ratingStar

\- priceDiscountRate

\- shopId

\- shopType

\- sellerCommissionRate

\- shopeeCommissionRate

Campos importantes para evolução futura:

\- sales

\- ratingStar

\- priceDiscountRate

\- commission

\- priceMin

\- priceMax

\- productCatIds

\---

\# shopee-api-test.js

Arquivo:

shopee-api-test.js

Funções atuais:

\- consulta por --item;

\- consulta por --keyword;

\- suporta --page;

\- suporta --limit;

\- suporta --schema;

\- suporta --product-fields;

\- mostra productCatIds;

\- mostra vendas;

\- avaliação;

\- desconto;

\- comissão;

\- priceMin;

\- priceMax.

Exemplo:

node .\\shopee-api-test.js --keyword "casa" --page 1 --limit 10

\---

\# Links de afiliado

A Affiliate API retorna offerLink no formato:

https://s.shopee.com.br/...

O adaptador:

shopee-product-url.js

resolve links curtos Shopee.

Domínios reconhecidos:

\- s.shopee.com.br

\- shope.ee

Foi descoberto e corrigido um formato adicional de URL resolvida:

/slug/shopId/itemId

Exemplo real:

https://shopee.com.br/opaanlp/1340075916/43173265179

Nesse formato:

1340075916 = shopId

43173265179 = itemId

Este formato já está suportado em shopee-product-url.js.

\---

\# Fluxo de importação validado

Fluxo completo validado:

Shopee Affiliate API

→ offerLink

→ link curto Shopee

→ resolução da URL

→ identificação shopId/itemId

→ productOfferV2

→ normalização

→ catálogo

→ Vitrine 2

Teste real:

20 produtos

→ importação de 1 produto via offerLink

→ 21 produtos

Funcionou.

\---

\# Importador automático

Arquivo:

importar-vitrine2-api.ps1

Objetivo:

buscar produtos diretamente pela Affiliate API e publicar automaticamente na Vitrine 2.

Comportamento:

\- consulta por palavras-chave;

\- usa paginação;

\- coleta offerLinks;

\- evita repetir links dentro da execução;

\- continua se algum produto falhar;

\- verifica total publicado;

\- para ao atingir a meta.

Primeira meta validada:

21 → 50 produtos.

Resultado:

Produtos antes: 21

Produtos adicionados: 29

Requisições aceitas: 30

Tentativas com falha: 0

Total publicado agora: 50

A diferença de 30 requisições aceitas para 29 produtos adicionados indica produto já existente/duplicado, comportamento esperado.

\---

\# Estado atual da Vitrine 2

Total:

50 produtos

Publicados:

50

Ocultos:

0

Admin funcionando em:

/admin/vitrine2

Recursos do Admin já funcionando:

\- busca;

\- filtro por categoria;

\- filtro por comissão;

\- filtro por status;

\- comissão visível somente no Admin;

\- publicar;

\- ocultar;

\- menu de publicação;

\- salvar posição;

\- sync manual;

\- último horário de sync.

Visual aprovado da Vitrine 2 não deve ser alterado nesta etapa.

\---

\# Product Sync

Product Sync está funcionando com a Shopee Affiliate Open API.

Últimos testes validados anteriormente:

Total: 20

Sucesso: 20

Indisponíveis ocultados: 0

Falhas temporárias: 0

Após expansão:

Admin mostrou 50 produtos publicados.

A lógica de mensagem de sync foi corrigida.

Arquivo:

vitrine2-sync-routes.js

Regra atual:

Se summary.failed > 0:

não informar sucesso completo.

Deve mostrar erro/aviso de falhas temporárias.

Commit:

23c0b86 — Handle temporary failures in Vitrine 2 sync

\---

\# Catálogo

Arquivo de dados:

data\\vitrine2-catalog.json

Estrutura:

version

savedAt

entries

Cada entry contém:

product

visibility

collections

O catálogo é alterado naturalmente por importações e sync.

Não incluir automaticamente data\\vitrine2-catalog.json em commits de código sem decisão explícita.

\---

\# Estrutura normalizada do produto

Campos observados:

\- source

\- marketplace

\- itemId

\- shopId

\- title

\- description

\- price

\- originalPrice

\- minPrice

\- maxPrice

\- currency

\- image

\- video

\- shopName

\- commissionRate

\- category1

\- category2

\- category3

\- originalUrl

\- resolvedUrl

\- affiliateLink

\- available

\- metadata

Arquivo principal:

product-normalizer.js

O normalizador já aceita:

category1

category2

category3

O problema atual não está no normalizador.

\---

\# Problema atual de categorias

Os 50 produtos importados pela Affiliate API estão atualmente com:

category1 = null

category2 = null

category3 = null

A causa foi localizada em:

shopee-product-url.js

A montagem do produto coloca atualmente:

category1: null

category2: null

category3: null

Não corrigir isso inventando categoria pelo título.

Usar os IDs oficiais da Shopee.

\---

\# productCatIds

A Affiliate API retorna:

productCatIds

A ordem foi confirmada como hierarquia:

\[category1, category2, category3]

Exemplo real:

productCatIds:

\[100636, 100716, 101209]

Produto:

Pano Bate Mão em Formato de Pirulito com Alça e Alta Absorção

Mapeamento confirmado via CSV:

100636 → Home \& Living

100716 → Home Care Supplies

101209 → Cleaning Cloths

\---

\# CSV Shopee / Data Feed

Pasta:

data\\shopee-feed

Arquivo analisado anteriormente:

1005\_200149\_Shopee Brasil - 2022\_20260820T045807\_1.csv

Tamanho aproximado:

188 MB

Quantidade analisada anteriormente:

aproximadamente 2 milhões de produtos.

O CSV contém:

global\_catid1

global\_category1

global\_catid2

global\_category2

global\_catid3

global\_category3

Exemplo:

global\_catid1: 100638

global\_category1: Stationery

global\_catid2: 100734

global\_category2: Notebooks \& Papers

global\_catid3: 101375

global\_category3: Loose Leaf

Portanto existe uma ponte oficial:

Affiliate API productCatIds

→ IDs do CSV

→ nomes oficiais da Shopee

\---

\# Sistema de tradução de categorias existente

Não criar outro sistema de tradução.

Arquivo:

shopee-category-map.js

Possui:

CATEGORY\_MAP

SUBCATEGORY\_MAP

Funções:

translateCategory()

translateSubcategory()

Exemplos:

Home \& Living

→ Casa e Decoração

Stationery

→ Papelaria

Beauty

→ Beleza

Mobile \& Gadgets

→ Celulares e Acessórios

\---

\# Category Registry

Arquivo gerador:

build-category-registry.js

Arquivo de dados:

data\\category-registry.json

Estrutura:

sourceName

displayName

status

subcategories

level3

Status:

translated

pending

Pipeline existente:

CSV Shopee

→ global\_category1

→ global\_category2

→ global\_category3

→ shopee-category-map.js

→ category-registry.json

O registry guarda nomes e traduções.

Ele não guarda atualmente os IDs numéricos das categorias.

\---

\# Pipeline correto de categorias

Arquitetura decidida:

Shopee Affiliate Open API

→ productCatIds

→ CSV Shopee

→ global\_catid1/2/3

→ global\_category1/2/3

→ shopee-category-map.js

→ category-registry.json

→ produto normalizado

→ Admin / Vitrine 2

Não criar tradução paralela.

Não classificar por título se houver ID oficial disponível.

\---

\# Arquivos-chave

server.js

shopee-api-test.js

shopee-product-url.js

product-source.js

product-normalizer.js

product-catalog.js

product-catalog-store.js

vitrine2-service.js

vitrine2-routes.js

vitrine2-product-sync.js

vitrine2-product-sync-service.js

vitrine2-product-sync-batch.js

vitrine2-sync-routes.js

importar-vitrine2-api.ps1

importar-20-vitrine2.ps1

feed-test.js

build-category-registry.js

shopee-category-map.js

data\\category-registry.json

data\\vitrine2-catalog.json

views\\admin-vitrine2.ejs

views\\vitrine2.ejs

\---

\# Vitrine 2 — regras visuais

Não alterar sem aprovação explícita:

\- visual atual;

\- grid aprovado;

\- layout mobile;

\- layout desktop;

\- cores;

\- cards;

\- menu;

\- estrutura pública.

Não mexer na Vitrine 1.

\---

\# Roadmap futuro

Após o catálogo e sync estarem estáveis:

\- ampliar catálogo para 100 produtos;

\- melhorar equilíbrio de categorias;

\- área de Oportunidades no Admin;

\- usar comissão;

\- desconto;

\- vendas;

\- avaliação;

\- cliques;

\- tendência;

\- destaques;

\- novidades;

\- promoções;

\- produtos da época;

\- automação de conteúdo;

\- vídeos;

\- publicação em redes sociais;

\- integração futura com Meta/Facebook;

\- VPS;

\- domínio;

\- produção.

Comissão deve permanecer somente no Admin.

\---

\# Próximo passo exato

NÃO aumentar para 100 produtos ainda.

Primeiro:

1\. Criar uma ponte reutilizável entre productCatIds e as categorias do CSV.

2\. Reutilizar o sistema de tradução existente.

3\. Preencher corretamente:

&#x20;  - category1

&#x20;  - category2

&#x20;  - category3

&#x20;  nos produtos importados pela Affiliate API.

4\. Atualizar os 50 produtos existentes.

5\. Validar filtros de categoria no Admin.

6\. Validar categorias na Vitrine 2.

7\. Fazer commit.

8\. Só depois avaliar expansão de 50 para 100 produtos.

\---

\# Regra para próximo chat

Ao abrir um novo chat:

Informar:

"Continuar o projeto Shopee BioLink SaaS. Primeiro leia o arquivo docs\\SHOPEE\_BIOLINK\_CONTEXT.md e continue exatamente da seção Próximo passo exato."

Não reinvestigar arquitetura já registrada neste documento.

---

\## Atualização — Categorias Shopee e Tradução Automática

Data: 25/08/2026

\### Situação concluída

A integração de categorias da Shopee foi implementada e validada.

Fluxo atual:

Shopee Affiliate Open API

→ `productCatIds`

→ Data Feed CSV da Shopee

→ resolução dos IDs para nomes oficiais

→ `category-registry.json`

→ tradução pt-BR

→ produto normalizado com `category1`, `category2` e `category3`

\### Arquivos principais

\- `category-id-resolver.js`

\- `shopee-product-url.js`

\- `data/category-registry.json`

\- `data/category-translations-pending.json`

\- `data/category-translations-complete.json`

\- `export-pending-category-translations.js`

\- `import-category-translations.js`

\### Category ID Resolver

O arquivo `category-id-resolver.js` passou a:

\- receber `productCatIds` vindos da Affiliate Open API;

\- construir um índice em memória a partir do Data Feed;

\- relacionar:

&#x20; - `global\_catid1` → `global\_category1`;

&#x20; - `global\_catid2` → `global\_category2`;

&#x20; - `global\_catid3` → `global\_category3`;

\- carregar o CSV apenas uma vez por processo Node;

\- reutilizar o índice em memória nas próximas resoluções;

\- consultar o `category-registry.json`;

\- registrar novas categorias automaticamente como `pending` quando necessário;

\- preservar o nome oficial da Shopee como fallback para evitar quebra da importação.

\### Estrutura real de categorias encontrada no Data Feed

Total atual:

\- Categorias principais: 29

\- Subcategorias: 249

\- Categorias nível 3: 1.016

\- Total geral: 1.294

\### Traduções

Antes da nova etapa existiam:

\- Categorias principais pendentes: 0

\- Subcategorias pendentes: 199

\- Nível 3 pendentes: 1.016

\- Total pendente: 1.215

Foi criado:

`export-pending-category-translations.js`

Esse script exportou as 1.215 pendências para:

`data/category-translations-pending.json`

As 1.215 traduções foram preenchidas em pt-BR e salvas em:

`data/category-translations-complete.json`

Depois foi criado:

`import-category-translations.js`

Resultado da importação:

\- Total recebido: 1.215

\- Atualizados: 1.215

\- Não encontrados: 0

\- Inválidos: 0

Resultado final do Registry:

\- Categorias pendentes: 0

\- Subcategorias pendentes: 0

\- Nível 3 pendentes: 0

\- Total pendente: 0

\### Teste real validado

Produto:

`Pano Bate Mão em Formato de Pirulito com Alça e Alta Absorção`

IDs Shopee:

\- categoryId1: `100636`

\- categoryId2: `100716`

\- categoryId3: `101209`

Nomes oficiais Shopee:

\- `Home \& Living`

\- `Home Care Supplies`

\- `Cleaning Cloths`

Resultado final pt-BR:

\- `Casa e Decoração`

\- `Produtos para Cuidados com a Casa`

\- `Panos de Limpeza`

O produto normalizado retornou corretamente:

```text

category1: 'Casa e Decoração'

category2: 'Produtos para Cuidados com a Casa'

category3: 'Panos de Limpeza'

---

## Atualização 25/08/2026 — Sync comercial e Admin Vitrine 2

### Sincronização dos 50 produtos

Foi concluída a sincronização completa dos 50 produtos publicados na Vitrine 2.

Resultado:

- Total: 50
- Sucesso: 50
- Indisponíveis ocultados: 0
- Falhas temporárias: 0

As categorias permaneceram corretas após a sincronização.

Estado das categorias:

- 50 produtos com `category1`
- 50 produtos com `category2`
- 45 produtos com `category3`
- 5 produtos sem `category3` porque a própria Shopee retorna `categoryId3 = 0`

Não deve ser inventada uma categoria de nível 3 para esses produtos.

Commit da integração de categorias no sync:

`4d7e2ba — Sync Shopee categories into Vitrine 2 catalog`


### Novos dados comerciais da Shopee

O `productOfferV2` foi expandido para trazer também:

- `priceDiscountRate`
- `commission`
- `sellerCommissionRate`
- `shopeeCommissionRate`
- `sales`
- `ratingStar`

Exemplo validado:

Item ID:

`22193593141`

Produto:

`Marmita infantil ZooKids com formato e estampa de animais fofos travas e talheres`

Dados retornados:

- Preço: R$ 23,90
- Comissão total: 0.83 = 83%
- Comissão estimada: R$ 19,837
- Comissão vendedor: 0.80
- Comissão Shopee: 0.03
- Vendas: 30
- Avaliação: 4.9
- Desconto: 4%

A comissão de 83% foi confirmada como valor real retornado pela API para esse produto.

Os novos dados passaram a ser gravados pelo Product Sync no catálogo.


### Arquivos alterados

- `shopee-product-url.js`
- `vitrine2-product-sync.js`
- `vitrine2-product-sync-service.js`
- `views/admin-vitrine2.ejs`


### Admin Vitrine 2

O Admin foi atualizado para exibir os seguintes dados por produto:

- Preço
- Comissão percentual
- Comissão estimada em reais
- Vendas
- Avaliação
- Status
- Posição
- Publicação
- Ações

Exemplo visual:

`Comissão 83% | Estimada R$ 19,84 | Vendas 30 | Avaliação 4,9 ★`

O nome do produto no Admin agora é clicável.

Ao clicar no nome:

- abre a página oficial do produto na Shopee;
- abre em nova aba;
- permite conferir rapidamente o preço e o produto diretamente na Shopee.

Foi realizado ajuste fino no layout do Admin:

- nome do produto permanece em negrito;
- valores deixaram de usar negrito;
- colunas ficaram mais compactas;
- coluna `Ações` voltou a ficar totalmente visível;
- botão de posição aparece como `Salvar`;
- layout final aprovado visualmente.


### Estado atual validado

- Vitrine 2 pública permanece sem alteração visual.
- Admin Vitrine 2 funcionando.
- Categorias em português funcionando.
- Filtro de categorias funcionando.
- Sync via Admin funcionando.
- 50 produtos sincronizados.
- Dados comerciais sincronizados.
- Link direto para Shopee funcionando.


### Último commit estável

`e512a05 — Add commercial metrics to Vitrine 2 admin`

Push realizado com sucesso para `origin/main`.

---


# Futuro Próximo — Radar de Oportunidades

## Objetivo

Criar um motor interno no Admin capaz de descobrir produtos com maior potencial comercial antes de publicá-los na Vitrine.

O Radar não será uma pesquisa manual ou pontual.
Ele deverá fazer parte do sistema e funcionar como uma camada permanente de descoberta e análise de oportunidades.

## Problema que resolve

Hoje o sistema consegue analisar produtos que já entraram no catálogo, utilizando dados como:

- vendas;
- avaliação;
- comissão;
- comissão estimada;
- preço;
- disponibilidade.

Porém, ainda não existe um mecanismo que responda automaticamente:

- quais produtos estão mais quentes no momento;
- quais estão sendo mais pesquisados;
- quais estão crescendo em interesse;
- quais têm alta aceitação;
- quais estão vendendo mais;
- quais produtos merecem entrar na Vitrine.

## Arquitetura conceitual

Fontes externas de tendência
        ↓
Descoberta de produtos/termos em alta
        ↓
Busca e validação correspondente na Shopee
        ↓
Métricas comerciais da Shopee
        ↓
Nota de Tendência
        +
Nota Comercial
        ↓
Nota Final de Oportunidade
        ↓
Admin
        ↓
Aprovação manual / assistida / automática
        ↓
Vitrine
        ↓
Central de Marketing

## Fontes de dados previstas

Priorizar fontes oficiais e integrações oficiais sempre que possível.

Fontes inicialmente consideradas:

- Google Trends;
- dados de popularidade/produtos do ecossistema Google;
- Shopee Affiliate Open API;
- Shopee Data Feed;
- futuramente sinais públicos de outras plataformas, quando houver integração oficial adequada.

Cada fonte deverá ter sua função claramente definida.

Exemplo:

Google / fontes externas:
- tendência;
- crescimento de interesse;
- popularidade;
- procura.

Shopee:
- vendas;
- avaliação;
- preço;
- desconto;
- comissão;
- comissão estimada;
- disponibilidade.

## Notas do motor

O Radar deverá trabalhar com pelo menos três avaliações separadas:

### Nota de Tendência

Mede a força externa do produto.

Exemplos de fatores:

- crescimento das pesquisas;
- popularidade recente;
- velocidade de crescimento;
- presença em tendências.

### Nota Comercial Shopee

Mede a qualidade da oportunidade dentro da Shopee.

Exemplos:

- vendas;
- avaliação;
- comissão;
- comissão estimada;
- desconto;
- preço;
- disponibilidade.

### Nota Final de Oportunidade

Combina tendência externa e força comercial da oferta Shopee.

O modelo de pesos será definido e testado antes da implementação definitiva.

## Movimento da oportunidade

Além da nota atual, o Radar deverá analisar evolução ao longo do tempo.

Estados previstos:

- Em alta;
- Crescendo;
- Estável;
- Perdendo força.

Isso evita escolher apenas produtos com números históricos altos que já estejam esfriando.

## Decisão de publicação

O administrador deverá manter controle sobre a automação.

Modos previstos:

### Manual

O Radar recomenda.
O administrador decide se o produto entra na Vitrine.

### Assistido

O sistema pré-seleciona produtos que atendem às regras.
O administrador confirma a publicação.

### Automático

Produtos que atendem aos critérios definidos podem entrar automaticamente na Vitrine.

A automação deverá poder ser ligada/desligada globalmente e futuramente por categoria.

## Ações previstas no Admin

Para cada oportunidade:

- Publicar na Vitrine;
- Selecionar para Marketing;
- Ignorar;
- Bloquear produto;
- acompanhar evolução da oportunidade.

## Curadoria contínua

O motor não deverá apenas inserir produtos.

Também deverá identificar produtos que:

- ficaram indisponíveis;
- perderam força;
- tiveram queda significativa de avaliação;
- deixaram de atender aos critérios definidos.

De acordo com as regras do administrador, esses produtos poderão ser sinalizados ou retirados automaticamente da Vitrine.

## Posição no projeto

O Radar de Oportunidades é considerado uma etapa futura próxima e de alta prioridade.

Entretanto, sua implementação NÃO deve começar antes da conclusão funcional da Central de Marketing.

Ordem definida:

1. concluir seleção persistente para Marketing;
2. concluir status do fluxo de Marketing;
3. concluir escolha/organização por canais;
4. concluir preparação de conteúdo;
5. evoluir agendamento/publicação;
6. considerar a Central de Marketing funcional;
7. iniciar o Radar de Oportunidades.

Regra de desenvolvimento:

Não iniciar um novo braço principal enquanto o braço atual não estiver funcional, testado, documentado e salvo no Git.


## Decisão temporária de canais de Marketing

Nesta fase, a chave interna `marketing.channels.outros`
será reaproveitada visualmente como **Pinterest**.

Motivo:
- a estrutura de persistência, API e tela já existe para `outros`;
- permite adicionar Pinterest sem criar uma nova camada agora.

Regra temporária:
- `outros = Pinterest` na interface;
- futuramente, quando "Outros" voltar a existir,
  criar uma nova chave separada e migrar Pinterest para `pinterest`.
```

## Central de Marketing — Canais por produto concluídos — 27/08/2026

Estado validado:

- seleção independente de canais por produto;
- canais atuais: Instagram, Facebook, TikTok, Kwai e Pinterest;
- Pinterest usa temporariamente a chave interna `marketing.channels.outros`;
- seleção geral de Marketing permanece independente dos canais;
- marcação e desmarcação por canal persistem após recarregar a página;
- confirmação visual ao adicionar/remover produto de um canal;
- filtro da Visão Geral por canal funcionando;
- opção "Sem canal" funcionando;
- cada aba exibe somente seus respectivos produtos;
- estado vazio validado quando um canal não possui produtos.

Backend validado:

- `setMarketingChannel`;
- `listMarketingByChannel`;
- PATCH `/api/vitrine2/products/:marketplace/:itemId/marketing/channel/:channel`;
- GET `/api/vitrine2/marketing/channel/:channel`.

Views validadas:

- `views/marketing-overview.ejs`;
- `views/marketing-instagram.ejs`;
- `views/marketing-facebook.ejs`;
- `views/marketing-tiktok.ejs`;
- `views/marketing-kwai.ejs`;
- `views/marketing-outros.ejs` — exibido visualmente como Pinterest.

Próximo passo:

- salvar esta etapa no Git;
- continuar a Central de Marketing;
- não iniciar o Radar de Oportunidades antes de concluir o braço de Marketing.


---

## Atualização — 29/08/2026 — Instagram automático + Policy Engine

### Instagram

A integração do Marketing com Instagram deixou de depender da seleção manual de produtos por canal.

Fluxo atual validado:

Produto publicado
-> candidato automático ao Instagram
-> Instagram Policy Engine
-> APPROVED / NEEDS_REVIEW / BLOCKED / REVALIDATE

Implementado:

- todos os produtos publicados entram automaticamente como candidatos ao Instagram;
- criada função `listInstagramMarketingCandidates()` em `vitrine2-service.js`;
- criada rota:
  `GET /api/vitrine2/marketing/instagram/candidates`;
- aba Instagram passou a consumir os candidatos automáticos;
- Policy Engine do Instagram integrado ao backend;
- validação individual disponível por produto;
- resumo visual de políticas na aba Instagram;
- filtros por status de política;
- arquitetura antiga de seleção por canal foi preservada para compatibilidade.

### Policy Engine Instagram

Arquivos:

- `policies/instagram-policy.js`
- `instagram-policy-validator.js`

Estados utilizados:

- APPROVED
- NEEDS_REVIEW
- BLOCKED
- REVALIDATE

Princípios definidos:

- bloqueio automático somente quando houver regra oficial aplicável;
- ambiguidades ficam em NEEDS_REVIEW;
- decisões possuem versão da política e fonte oficial;
- produto deve ser revalidado antes de automações sensíveis;
- política de cada canal será independente.

### Teste validado

Após reiniciar o servidor e abrir Marketing -> Instagram:

- 100 produtos carregados automaticamente;
- 100 produtos APPROVED;
- 0 BLOCKED;
- 0 NEEDS_REVIEW;
- 0 REVALIDATE;
- interface funcionando normalmente.

### Próximo passo exato

Automatizar a geração do pacote de conteúdo do Instagram para produtos APPROVED:

Produto aprovado
-> geração automática de conteúdo
-> Feed
-> Reels
-> Stories
-> fila/status
-> futura publicação via integração oficial Meta/Instagram.

Manter o desenvolvimento um arquivo por vez, sempre validando antes de avançar.


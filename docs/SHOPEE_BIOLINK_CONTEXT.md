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


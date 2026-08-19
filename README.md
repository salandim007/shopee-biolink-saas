# Shopee BioLink SaaS

Uma aplicação minimalista de vitrine de afiliados Shopee, pensada para rodar rápido em VPS e ser usada como um mini-app de vendas mobile-first.

## Objetivo do projeto

Este projeto serve como um SaaS simples de "Link na Bio" para afiliados da Shopee. A ideia é oferecer uma lojinha pública otimizada para celular, com:

- Página de produto com aparência de aplicativo móvel.
- Redirecionamento por cliques para links de afiliado.
- Registro automático de estatísticas de cliques.
- Backend leve com Node.js + Express + SQLite.

## Como funciona

1. O servidor Express inicializa e cria o banco SQLite automaticamente.
2. Uma loja é identificada pelo `slug_loja` do afiliado.
3. A rota pública `GET /l/:slug` renderiza a página da lojinha com produtos e categorias.
4. Quando o visitante clica em um produto, a rota `GET /click/:id` incrementa o contador de cliques e redireciona para o link afiliado.
5. Produtos podem ser cadastrados via API `POST /api/produtos`.

## Estrutura do sistema

- `server.js`: servidor Express, rotas e inicialização do banco de dados.
- `database.sqlite`: banco de dados SQLite local.
- `views/lojinha.ejs`: template de frontend mobile-first usando Tailwind CSS via CDN.
- `package.json`: definição das dependências do projeto.

### Tabelas do banco de dados

- `usuarios`
  - `id`, `nome`, `email`, `slug_loja`
- `categorias`
  - `id`, `nome`, `slug`
- `produtos`
  - `id`, `usuario_id`, `categoria_id`, `titulo`, `preco_original`, `preco_oferta`, `imagem_url`, `link_afiliado`, `cliques`

## Rotas principais

- `GET /l/:slug`
  - Renderiza a lojinha do afiliado.
- `GET /click/:id`
  - Incrementa o clique e redireciona para o link afiliado.
- `POST /api/produtos`
  - Cria um novo produto para o sistema.

## Rodando localmente

No diretório `C:\Users\Douglas\App Shopee\shopee-biolink-saas`:

```bash
npm install
node server.js
```

Depois, acesse:

```bash
http://localhost:3000/l/achadosdaana
```

## Visão de arquitetura

- **Frontend**: renderizado no servidor via EJS, com layout responsivo e design de aplicativo móvel usando Tailwind CSS.
- **Backend**: Node.js com Express para tratamento de rotas, APIs e renderização de templates.
- **Persistência**: SQLite local para manter dados de usuários, categorias e produtos sem necessidade de servidor de banco externo.
- **Escopo**: solução leve, rápida de implantar e fácil de migrar para VPS ou Docker.

## Observações

- O projeto já inicializa `categorias` padrão e cria um usuário de teste `achadosdaana`.
- Para testar cadastro de produtos, use a rota `POST /api/produtos` com dados JSON.
- O banco local `database.sqlite` será criado automaticamente na primeira execução.

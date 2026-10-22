# Publicacao independente de Reels

## Objetivo

Permitir publicar o mesmo video no Instagram, no Facebook
ou nos dois canais simultaneamente.

## Regras

- Cada canal possui reserva e status independentes.
- PUBLISHED nao deve gerar nova publicacao no mesmo canal.
- PROCESSING nao deve gerar reenvio automatico.
- FAILED exige verificacao antes de reenviar Reel.
- Bloqueio de um canal nao impede o outro.
- Timeout ou falha de rede preserva PROCESSING.
- Fotos e carrosseis mantem o comportamento anterior.

## Validacao realizada na homologacao

- Nove cenarios de publicacao independente aprovados.
- Timeout Instagram com sucesso Facebook aprovado.
- Segunda tentativa sem duplicidade aprovada.
- MP4 e URL assinada aprovados.
- Assinatura invalida rejeitada.

Os testes usaram Meta simulada, sem publicacoes reais.

## Implantacao

Validar interface e recuperacao do container antes de
qualquer recriacao da producao.

Nao recriar o container original sem plano de recuperacao
da imagem e da sessao autenticada da Shopee.

## Integracoes futuras

Manter arquitetura por canal para incorporar posteriormente
TikTok, Kwai e YouTube Shorts.

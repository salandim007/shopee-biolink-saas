# RECUPERAÇÃO SHOPEE — 21/10/2026

## REFERÊNCIA DE SEGURANÇA

Branch: feature/facebook-reels-multicanal
Commit: fdea649
Tag: captura-shopee-validada-20261021

Esta é a referência Git da recuperação realizada em 21/10/2026.

## REGRA OBRIGATÓRIA

NÃO apagar, substituir, restaurar versões antigas ou refatorar
o capturador Shopee sem autorização expressa e teste isolado.

Preservar especialmente:
- shopee-browser-media-capture.js
- product-media-orchestrator.js
- product-media-providers/shopee.js
- sessão persistente do Chromium
- views/video-production.ejs
- marketing/reel-generator.js

Não reiniciar Docker/Chromium como primeira tentativa de correção.

## CAPTURA RECUPERADA

Produto de teste:
https://shopee.com.br/product/1526576446/53616416772

Resultado observado em 21/10/2026:
15 URLs de imagens capturadas em aproximadamente 6 segundos.
Fotos adicionais apareceram corretamente na Central.

A recuperação envolveu autenticação manual na Shopee
pelo Chromium persistente, usando acesso visual com noVNC.

Mudanças registradas no capturador:
- reconhecimento ampliado de URLs resize_w;
- reconhecimento de /verify/traffic/error e /verify/captcha;
- campo failureReason para diagnóstico.

## COMANDOS E PROCEDIMENTO DE RECUPERAÇÃO

Consultar docs/MEDIA-PIPELINE.md, seção:
"RECUPERAÇÃO DA GALERIA SHOPEE — VALIDADO EM 2026-10-08".

Essa seção contém comandos de Xvfb, x11vnc, websockify,
túnel SSH, verificação do container e testes do provider.

Nunca versionar cookies, perfis Chromium, tokens ou bancos.

## AVATARES E ELEMENTOS DE VÍDEO

Em 21/10/2026 a biblioteca não aparecia porque um
addEventListener em elemento ausente interrompia o script
antes da chamada loadLibrary().

A correção protegeu os listeners de catalogProductSearchBtn
e catalogProductSearch quando seus elementos não existem.

Arquivos preservados:
- avatar-com-logotipo.mp4
- fechamento-padrao.mp4
- trilha-padrao.mp3

A tela voltou a mostrar os elementos após sua atualização.

## ANTES DE QUALQUER ALTERAÇÃO FUTURA

1. Consultar esta documentação e docs/MEDIA-PIPELINE.md.
2. Confirmar branch, commit e git status.
3. Criar backup específico do arquivo envolvido.
4. Alterar somente o módulo responsável pelo problema.
5. Validar captura, galeria, biblioteca e produção de vídeo.
6. Nunca usar restauração geral para resolver falha localizada.

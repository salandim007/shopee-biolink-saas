---
name: hyperframes-video-production
description: Produz vídeos comerciais com fotografias reais usando HyperFrames.
---

# Skill — HyperFrames Video Production

## Objetivo
Produzir vídeos comerciais para o Mix de Produtos
utilizando o HyperFrames como motor criativo principal.

## Integração
Coordenador futuro: Diretor Criativo IA.

Fonte de fotografias:
Estúdio Criativo IA da homologação.

## Entradas
- Identificação do produto
- De 1 a 5 fotografias reais
- Título comercial
- Template visual
- Storyboard
- Duração desejada
- Chamada comercial

## Execução
1. Validar as fotografias recebidas.
2. Organizar as cenas do storyboard.
3. Preparar variáveis da composição.
4. Utilizar composição HyperFrames existente.
5. Executar renderização.
6. Verificar arquivo MP4.
7. Entregar vídeo para revisão humana.

## Motor
HyperFrames 0.8.186

Executável:
/home/admin/hyperframes-lab/node_modules/.bin/hyperframes

## Saída
Formato: MP4
Resolução: 1080x1920
Proporção: 9:16

## Estados
PENDING
PROCESSING
COMPLETED
FAILED
AWAITING_APPROVAL
APPROVED

## Regras de segurança
- Nunca publicar automaticamente.
- Nunca modificar a produção.
- Nunca substituir composições aprovadas.
- Não reconstruir a captura de fotografias.
- Não criar um segundo motor de renderização.
- Validar entradas antes de executar.
- Registrar erros e resultados.
- Exigir aprovação humana antes da publicação.

## Primeira implementação
Composição: mix-produto-vertical-v1
Template: Mix Impacto
Duração inicial: 15 segundos
Fotografias: até 5

## Situação
Contrato inicial documentado.
Implementação e renderização ainda pendentes.

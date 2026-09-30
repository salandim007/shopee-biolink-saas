#!/usr/bin/env bash

set -u

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

APP="/opt/shopee-biolink-saas"
TZ_NAME="America/Sao_Paulo"

STAMP="$APP/data/ai/nightly-last-success-date"

BRAZIL_DATE="$(
  TZ="$TZ_NAME" date +%F
)"

BRAZIL_HOUR="$(
  TZ="$TZ_NAME" date +%H
)"

echo "[$(
  TZ="$TZ_NAME" date '+%F %T'
)] Verificação do processamento noturno."

# Antes das 02:00 não executa.
if (( 10#$BRAZIL_HOUR < 2 )); then
  echo "Ainda não chegou o horário da madrugada."
  exit 0
fi

# Já terminou hoje? Não executa novamente.
if [[ -f "$STAMP" ]]; then
  LAST_DATE="$(
    cat "$STAMP" 2>/dev/null || true
  )"

  if [[ "$LAST_DATE" == "$BRAZIL_DATE" ]]; then
    echo "Processamento de hoje já concluído."
    exit 0
  fi
fi

echo "========================================"
echo "INICIANDO PREPARAÇÃO NOTURNA"
echo "Data Brasil: $BRAZIL_DATE"
echo "========================================"

if docker exec \
  shopee-biolink \
  node /app/ai/run-nightly-content-prep.js
then

  printf '%s\n' \
    "$BRAZIL_DATE" \
    > "$STAMP"

  echo "========================================"
  echo "PREPARAÇÃO NOTURNA CONCLUÍDA"
  echo "========================================"

  exit 0
fi

echo "========================================"
echo "FALHA GERAL NA PREPARAÇÃO NOTURNA"
echo "Será tentada novamente na próxima hora."
echo "========================================"

exit 1

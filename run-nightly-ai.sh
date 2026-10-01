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

BRAZIL_TIME="$(
  TZ="$TZ_NAME" date '+%F %T'
)"

#
# Janela oficial de processamento:
# 02:00 até 06:59 no horário de São Paulo.
#
# O cron chama este script de hora em hora.
# Fora da janela, ele termina sem processar.
#
if (( 10#$BRAZIL_HOUR < 2 || 10#$BRAZIL_HOUR > 6 )); then
  exit 0
fi

echo "[$BRAZIL_TIME] Verificação do processamento noturno."

#
# Se já terminou com sucesso no dia atual,
# não executa novamente.
#
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
echo "Hora Brasil: $BRAZIL_TIME"
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
  echo "Data Brasil: $BRAZIL_DATE"
  echo "========================================"

  exit 0
fi

echo "========================================"
echo "FALHA GERAL NA PREPARAÇÃO NOTURNA"
echo "Nova tentativa ocorrerá na próxima hora"
echo "dentro da janela 02:00-06:59 Brasil."
echo "========================================"

exit 1

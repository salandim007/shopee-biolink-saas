#!/bin/sh
set -eu

echo "[startup] Limpando Xvfb antigo..."
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99

echo "[startup] Iniciando Xvfb :99..."
Xvfb :99 \
  -screen 0 1280x1024x24 \
  -nolisten tcp \
  >/tmp/xvfb.log 2>&1 &

export DISPLAY=:99

sleep 1

echo "[startup] Preparando perfil Chromium..."

mkdir -p /app/data/chrome-shopee-persistent

rm -f   /app/data/chrome-shopee-persistent/SingletonLock   /app/data/chrome-shopee-persistent/SingletonSocket   /app/data/chrome-shopee-persistent/SingletonCookie

echo "[startup] Iniciando Chromium persistente..."

chromium \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-dev-shm-usage \
  --no-first-run \
  --no-default-browser-check \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir=/app/data/chrome-shopee-persistent \
  --lang=pt-BR \
  --window-size=1366,900 \
  about:blank \
  >/tmp/chrome-shopee-persistent.log 2>&1 &

sleep 3

echo "[startup] Iniciando SaaS..."
exec node server.js

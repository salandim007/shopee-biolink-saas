#!/bin/bash
set -e

cd /opt/shopee-biolink-saas

echo "========================================"
echo "SYNC INICIADO: $(date)"
echo "========================================"

echo ""
echo "[1/2] Sincronizando Vitrine 2 com Shopee..."
docker compose exec -T shopee-biolink node vitrine2-product-sync-batch.js

echo ""
echo "[2/2] Gerando feed Meta..."
python3 meta-catalog-sync.py

echo ""
echo "========================================"
echo "SYNC CONCLUÍDO: $(date)"
echo "========================================"

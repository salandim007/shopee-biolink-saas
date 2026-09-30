#!/bin/bash
set -euo pipefail

cd /opt/shopee-biolink-saas

docker exec \
  -e AI_TIMEOUT_MS=600000 \
  shopee-biolink \
  sh -lc '
    cd /app
    node ai/run-content-jobs.js
  '

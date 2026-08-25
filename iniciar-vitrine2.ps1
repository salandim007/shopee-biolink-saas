$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VITRINE 2 - INICIALIZACAO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 1. CONFERE SE ESTAMOS NA RAIZ DO PROJETO
# ============================================================

if (-not (Test-Path ".\server.js")) {
    Write-Host "ERRO: server.js nao encontrado." -ForegroundColor Red
    Write-Host "Abra o PowerShell na raiz do projeto antes de executar este script." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path ".\vitrine2-product-sync-batch.js")) {
    Write-Host "ERRO: vitrine2-product-sync-batch.js nao encontrado." -ForegroundColor Red
    exit 1
}

Write-Host "Projeto encontrado." -ForegroundColor Green
Write-Host ""

# ============================================================
# 2. CONFERE CREDENCIAIS DA SHOPEE
# ============================================================

if ([string]::IsNullOrWhiteSpace($env:SHOPEE_AFFILIATE_APP_ID)) {
    Write-Host "ERRO: SHOPEE_AFFILIATE_APP_ID nao esta carregada neste terminal." -ForegroundColor Red
    Write-Host ""
    Write-Host "Carregue suas variaveis da Shopee e execute novamente." -ForegroundColor Yellow
    exit 1
}

if ([string]::IsNullOrWhiteSpace($env:SHOPEE_AFFILIATE_SECRET)) {
    Write-Host "ERRO: SHOPEE_AFFILIATE_SECRET nao esta carregada neste terminal." -ForegroundColor Red
    Write-Host ""
    Write-Host "Carregue suas variaveis da Shopee e execute novamente." -ForegroundColor Yellow
    exit 1
}

Write-Host "Credenciais da Shopee encontradas." -ForegroundColor Green
Write-Host ""

# ============================================================
# 3. SINCRONIZA PRODUTOS PUBLICADOS
# ============================================================

Write-Host "Sincronizando produtos publicados..." -ForegroundColor Cyan
Write-Host ""

node .\vitrine2-product-sync-batch.js

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRO: a sincronizacao encontrou um erro fatal." -ForegroundColor Red
    Write-Host "O servidor nao sera iniciado automaticamente." -ForegroundColor Yellow
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Sincronizacao concluida." -ForegroundColor Green
Write-Host ""

# ============================================================
# 4. VALIDA SERVER.JS
# ============================================================

Write-Host "Validando server.js..." -ForegroundColor Cyan

node --check .\server.js

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRO: server.js possui erro de sintaxe." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "server.js validado." -ForegroundColor Green
Write-Host ""

# ============================================================
# 5. INICIA O SERVIDOR
# ============================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INICIANDO SERVIDOR DA VITRINE 2" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para encerrar o servidor, pressione CTRL+C." -ForegroundColor Yellow
Write-Host ""

node .\server.js

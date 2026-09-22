# Mix de Produtos - Instalador do Radar Facebook no Windows

$ErrorActionPreference = "Stop"

$TaskName = "MixDeProdutos-FacebookRadarSync"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " MIX DE PRODUTOS - INSTALADOR RADAR FB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Este arquivo deve ficar em:
# <projeto>\scripts\instalar-facebook-radar-windows.ps1
$Project = Split-Path -Parent $PSScriptRoot
$SyncScript = Join-Path $Project "facebook-radar-sync.ps1"

$ExportDir = Join-Path $env:LOCALAPPDATA "FBValidadorGrupos\Exports"

Write-Host "Projeto detectado:"
Write-Host $Project
Write-Host ""

if (-not (Test-Path $SyncScript)) {
    Write-Host "ERRO: facebook-radar-sync.ps1 nao encontrado." -ForegroundColor Red
    Write-Host "Esperado em: $SyncScript" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] facebook-radar-sync.ps1 encontrado." -ForegroundColor Green

if (-not (Get-Command powershell.exe -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: powershell.exe nao encontrado." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command scp.exe -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: scp.exe nao encontrado." -ForegroundColor Red
    Write-Host "Ative o OpenSSH Client do Windows." -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: ssh.exe nao encontrado." -ForegroundColor Red
    Write-Host "Ative o OpenSSH Client do Windows." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] PowerShell, SSH e SCP encontrados." -ForegroundColor Green

if (Test-Path $ExportDir) {
    Write-Host "[OK] Pasta do FB Validador encontrada:" -ForegroundColor Green
    Write-Host "     $ExportDir"
}
else {
    Write-Host "[AVISO] Pasta do FB Validador ainda nao existe:" -ForegroundColor Yellow
    Write-Host "        $ExportDir"
}

$User = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$SyncScript`"" `
    -WorkingDirectory $Project

$Trigger = New-ScheduledTaskTrigger `
    -AtLogOn `
    -User $User

$Principal = New-ScheduledTaskPrincipal `
    -UserId $User `
    -LogonType Interactive `
    -RunLevel Limited

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Principal $Principal `
    -Settings $Settings `
    -Description "Envia automaticamente os CSV do FB Validador para a VPS do Mix de Produtos." `
    -Force | Out-Null

Write-Host "[OK] Tarefa agendada criada/atualizada." -ForegroundColor Green

Start-ScheduledTask -TaskName $TaskName

Start-Sleep -Seconds 2

$Task = Get-ScheduledTask -TaskName $TaskName

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " INSTALACAO CONCLUIDA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tarefa : $($Task.TaskName)"
Write-Host "Estado : $($Task.State)"
Write-Host ""
Write-Host "O monitor sera iniciado automaticamente em cada login do Windows." -ForegroundColor Green

$Source = "$env:LOCALAPPDATA\FBValidadorGrupos\Exports"
$Dest = "admin@194.163.178.182:/opt/shopee-biolink-saas/data/facebook-radar/inbox/"

$known = @{}

Get-ChildItem $Source -File |
Where-Object { $_.Extension -in ".json", ".csv" } |
ForEach-Object {
    $known[$_.FullName] = $true
}

Write-Host "========================================"
Write-Host " MIX DE PRODUTOS - RADAR FACEBOOK"
Write-Host "========================================"
Write-Host "Monitorando:"
Write-Host $Source
Write-Host ""
Write-Host "Aguardando novas exportacoes..."

while ($true) {

    Get-ChildItem $Source -File |
    Where-Object { $_.Extension -in ".json", ".csv" } |
    ForEach-Object {

        if (-not $known.ContainsKey($_.FullName)) {

            Write-Host ""
            Write-Host "Novo arquivo:" $_.Name

            Start-Sleep -Seconds 1

            scp $_.FullName $Dest

            if ($LASTEXITCODE -eq 0) {
                $known[$_.FullName] = $true
                Write-Host "Enviado para VPS:" $_.Name
            }
            else {
                Write-Host "Falha no envio. Tentara novamente."
            }
        }
    }

    Start-Sleep -Seconds 3
}

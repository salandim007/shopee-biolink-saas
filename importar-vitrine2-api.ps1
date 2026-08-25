$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:3000"
$TargetCount = 50
$PageLimit = 10
$MaxPagesPerKeyword = 5

$Keywords = @(
    "casa"
    "cozinha"
    "beleza"
    "moda"
    "celular"
    "ferramentas"
    "pet"
)

$SeenLinks = @{}

function Get-PublishedCount {
    try {
        $Result = Invoke-RestMethod `
            -Method Get `
            -Uri "$BaseUrl/api/vitrine2/products/published" `
            -TimeoutSec 20

        return [int]$Result.count
    }
    catch {
        throw "Não foi possível consultar os produtos publicados da Vitrine 2."
    }
}

function Get-ShopeeOfferLinks {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Keyword,

        [Parameter(Mandatory = $true)]
        [int]$Page
    )

    Write-Host ""
    Write-Host "Buscando Shopee:" -ForegroundColor Cyan
    Write-Host "  Palavra-chave: $Keyword"
    Write-Host "  Página: $Page"

    $Output = & node `
        ".\shopee-api-test.js" `
        --keyword $Keyword `
        --page $Page `
        --limit $PageLimit `
        2>&1 | Out-String

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Falha na consulta da Affiliate API." -ForegroundColor Yellow
        return @()
    }

    $LinkMatches = [regex]::Matches(
        $Output,
        'Link afiliado:\s*(https?://[^\s\x1b]+)'
    )

    $Links = @()

    foreach ($Match in $LinkMatches) {
        $Link =
            $Match.Groups[1].Value.Trim()

        if (
            $Link -and
            -not $SeenLinks.ContainsKey($Link)
        ) {
            $SeenLinks[$Link] = $true
            $Links += $Link
        }
    }

    Write-Host "  Links novos encontrados: $($Links.Count)"

    return $Links
}

function Import-Vitrine2Product {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,

        [Parameter(Mandatory = $true)]
        [int]$Position
    )

    $Body = @{
        url = $Url
        published = $true
        featured = $false
        position = $Position
        collections = @()
    } | ConvertTo-Json -Depth 5

    try {
        $Result = Invoke-RestMethod `
            -Method Post `
            -Uri "$BaseUrl/api/vitrine2/import/api" `
            -ContentType "application/json" `
            -Body $Body `
            -TimeoutSec 90

        return $Result.success -eq $true
    }
    catch {
        $Message =
            $_.Exception.Message

        if (
            $_.ErrorDetails -and
            $_.ErrorDetails.Message
        ) {
            $Message =
                $_.ErrorDetails.Message
        }

        Write-Host "  Não importado: $Message" -ForegroundColor Yellow

        return $false
    }
}


Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VITRINE 2 - IMPORTAÇÃO AUTOMÁTICA API" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $CurrentCount =
        Get-PublishedCount
}
catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Confirme se o servidor está rodando." -ForegroundColor Yellow
    exit 1
}

Write-Host "Produtos publicados agora: $CurrentCount"
Write-Host "Meta desta execução: $TargetCount"
Write-Host ""

if ($CurrentCount -ge $TargetCount) {
    Write-Host "A Vitrine 2 já possui $CurrentCount produtos publicados." -ForegroundColor Green
    Write-Host "Nenhuma importação é necessária."
    exit 0
}

$InitialCount =
    $CurrentCount

$Attempts = 0
$ImportedRequests = 0
$Failed = 0

foreach ($Keyword in $Keywords) {

    if ($CurrentCount -ge $TargetCount) {
        break
    }

    for (
        $Page = 1;
        $Page -le $MaxPagesPerKeyword;
        $Page++
    ) {
        if ($CurrentCount -ge $TargetCount) {
            break
        }

        $Links =
            Get-ShopeeOfferLinks `
                -Keyword $Keyword `
                -Page $Page

        if ($Links.Count -eq 0) {
            Write-Host "  Nenhum candidato utilizável nesta página." -ForegroundColor Yellow
            continue
        }

        foreach ($ProductUrl in $Links) {

            if ($CurrentCount -ge $TargetCount) {
                break
            }

            $Attempts++

            $NextPosition =
                $CurrentCount + 1

            Write-Host ""
            Write-Host "[$CurrentCount/$TargetCount] Importando candidato:" -ForegroundColor Cyan
            Write-Host "  $ProductUrl"

            $Imported =
                Import-Vitrine2Product `
                    -Url $ProductUrl `
                    -Position $NextPosition

            if ($Imported) {
                $ImportedRequests++

                Start-Sleep -Milliseconds 500

                try {
                    $NewCount =
                        Get-PublishedCount
                }
                catch {
                    Write-Host "  Produto processado, mas não foi possível conferir o total." -ForegroundColor Yellow
                    continue
                }

                if ($NewCount -gt $CurrentCount) {
                    $CurrentCount =
                        $NewCount

                    Write-Host "  OK - Total publicado: $CurrentCount" -ForegroundColor Green
                }
                else {
                    Write-Host "  Produto já existente ou catálogo sem aumento." -ForegroundColor DarkYellow
                }
            }
            else {
                $Failed++
            }

            Start-Sleep -Milliseconds 700
        }
    }
}


Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESULTADO DA IMPORTAÇÃO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $FinalCount =
        Get-PublishedCount
}
catch {
    $FinalCount =
        $CurrentCount
}

$Added =
    $FinalCount - $InitialCount

Write-Host "Produtos antes: $InitialCount"
Write-Host "Produtos adicionados: $Added"
Write-Host "Requisições aceitas: $ImportedRequests"
Write-Host "Tentativas com falha: $Failed"
Write-Host "Total publicado agora: $FinalCount"
Write-Host ""

if ($FinalCount -ge $TargetCount) {
    Write-Host "SUCESSO: Vitrine 2 chegou a $FinalCount produtos publicados." -ForegroundColor Green
    Write-Host ""
    Write-Host "Abra ou atualize:"
    Write-Host "http://localhost:3000/vitrine2"
}
else {
    Write-Host "A meta de $TargetCount produtos ainda não foi atingida." -ForegroundColor Yellow
    Write-Host "O script esgotou os candidatos configurados nesta execução."
}
$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:3000"
$TargetCount = 20

$CandidateUrls = @(
    "https://shopee.com.br/product/579978597/23594525565"
    "https://shopee.com.br/product/326891807/10239969246"
    "https://shopee.com.br/product/423978122/14064388819"
    "https://shopee.com.br/product/1325738150/23598004054"
    "https://shopee.com.br/product/1696255660/58254333098"
    "https://shopee.com.br/product/549528890/20398296044"
    "https://shopee.com.br/product/470695935/22293117305"
    "https://shopee.com.br/product/1012725449/22195943689"
    "https://shopee.com.br/product/1104525762/58257729398"
    "https://shopee.com.br/product/1753398912/58265124286"
    "https://shopee.com.br/product/490604318/58208687484"
    "https://shopee.com.br/product/771011426/58113577411"
    "https://shopee.com.br/product/510736884/23594931015"
    "https://shopee.com.br/product/1288072236/22598154293"
    "https://shopee.com.br/product/1096453915/20697455669"
    "https://shopee.com.br/product/1731690990/58213758018"
    "https://shopee.com.br/product/361929938/58255430563"
    "https://shopee.com.br/product/1595306121/22998785704"
    "https://shopee.com.br/product/1620515295/22694525800"
    "https://shopee.com.br/product/422097784/9443412391"
    "https://shopee.com.br/product/1516694870/23599154977"
    "https://shopee.com.br/product/589728500/49309629780"
    "https://shopee.com.br/product/1209790202/58202550202"
    "https://shopee.com.br/product/1591993188/50806495242"
    "https://shopee.com.br/product/1281436474/18498032699"
    "https://shopee.com.br/product/1530596344/23898453597"
    "https://shopee.com.br/product/331040938/58211749776"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VITRINE 2 - CARGA ATE 20 PRODUTOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $Current = Invoke-RestMethod `
        -Method Get `
        -Uri "$BaseUrl/api/vitrine2/products/published" `
        -TimeoutSec 20
}
catch {
    Write-Host "ERRO: nao consegui acessar a Vitrine 2." -ForegroundColor Red
    Write-Host "Confirme se o servidor esta rodando com: node server.js" -ForegroundColor Yellow
    exit 1
}

$CurrentCount = [int]$Current.count

Write-Host "Produtos publicados agora: $CurrentCount"

if ($CurrentCount -ge $TargetCount) {
    Write-Host ""
    Write-Host "A vitrine ja possui $CurrentCount produtos publicados." -ForegroundColor Green
    Write-Host "Nenhuma importacao foi necessaria."
    exit 0
}

$Needed = $TargetCount - $CurrentCount

Write-Host "Produtos que faltam para chegar a 20: $Needed"
Write-Host ""

$Imported = 0
$Failed = 0

foreach ($ProductUrl in $CandidateUrls) {

    if (($CurrentCount + $Imported) -ge $TargetCount) {
        break
    }

    $Position = $CurrentCount + $Imported + 1

    $Body = @{
        url = $ProductUrl
        published = $true
        featured = $false
        position = $Position
        collections = @()
    } | ConvertTo-Json -Depth 5

    Write-Host "[$Position/$TargetCount] Importando:" -ForegroundColor Cyan
    Write-Host "  $ProductUrl"

    try {
        $Result = Invoke-RestMethod `
            -Method Post `
            -Uri "$BaseUrl/api/vitrine2/import/api" `
            -ContentType "application/json" `
            -Body $Body `
            -TimeoutSec 60

        if ($Result.success -eq $true) {
            $Imported++
            Write-Host "  OK" -ForegroundColor Green
        }
        else {
            $Failed++
            Write-Host "  Nao importado." -ForegroundColor Yellow
        }
    }
    catch {
        $Failed++

        $Message = $_.Exception.Message

        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $Message = $_.ErrorDetails.Message
        }

        Write-Host "  Falhou: $Message" -ForegroundColor Yellow
        Write-Host "  Pulando para o proximo produto..."
    }

    Start-Sleep -Milliseconds 700
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFERINDO RESULTADO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

try {
    $Final = Invoke-RestMethod `
        -Method Get `
        -Uri "$BaseUrl/api/vitrine2/products/published" `
        -TimeoutSec 20

    Write-Host ""
    Write-Host "Importados nesta execucao: $Imported"
    Write-Host "Tentativas que falharam: $Failed"
    Write-Host "Total publicado na Vitrine 2: $($Final.count)" -ForegroundColor Green

    if ([int]$Final.count -ge $TargetCount) {
        Write-Host ""
        Write-Host "SUCESSO: Vitrine 2 chegou a 20 produtos." -ForegroundColor Green
        Write-Host "Atualize no navegador: http://localhost:3000/vitrine2"
    }
    else {
        Write-Host ""
        Write-Host "Ainda faltam produtos para chegar a 20." -ForegroundColor Yellow
        Write-Host "Me envie esta tela para verificarmos quais chamadas falharam."
    }
}
catch {
    Write-Host ""
    Write-Host "As importacoes terminaram, mas nao consegui fazer a conferencia final." -ForegroundColor Yellow
}

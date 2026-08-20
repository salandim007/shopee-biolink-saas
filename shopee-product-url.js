const crypto = require('crypto');

const SHOPEE_API_ENDPOINT =
    'https://open-api.affiliate.shopee.com.br/graphql';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

function getShopeeCredentials() {
    const appId = process.env.SHOPEE_AFFILIATE_APP_ID;
    const secret = process.env.SHOPEE_AFFILIATE_SECRET;

    if (!appId) {
        throw new Error(
            'Variável SHOPEE_AFFILIATE_APP_ID não encontrada.'
        );
    }

    if (!secret) {
        throw new Error(
            'Variável SHOPEE_AFFILIATE_SECRET não encontrada.'
        );
    }

    return {
        appId,
        secret
    };
}


// ============================================================
// AUTENTICAÇÃO SHOPEE AFFILIATE OPEN API
// ============================================================

function createShopeeAuthorization(payload) {
    const { appId, secret } = getShopeeCredentials();

    const timestamp = Math.floor(Date.now() / 1000).toString();

    const signatureBase =
        appId +
        timestamp +
        payload +
        secret;

    const signature = crypto
        .createHash('sha256')
        .update(signatureBase)
        .digest('hex');

    const authorization =
        `SHA256 Credential=${appId}, ` +
        `Timestamp=${timestamp}, ` +
        `Signature=${signature}`;

    return {
        authorization,
        timestamp
    };
}


// ============================================================
// NORMALIZA URL
// ============================================================

function normalizeUrl(url) {
    if (!url || typeof url !== 'string') {
        throw new Error('URL da Shopee não informada.');
    }

    return url.trim();
}


// ============================================================
// IDENTIFICA SHOP ID / ITEM ID
// ============================================================

function extractShopeeIds(url) {
    const cleanUrl = normalizeUrl(url);

    const patterns = [
        // Formato:
        // https://shopee.com.br/Produto-i.840395204.23697718715
        /-i\.(\d+)\.(\d+)/i,

        // Formato:
        // https://shopee.com.br/product/840395204/23697718715
        /\/product\/(\d+)\/(\d+)/i,

        // Alguns links podem conter:
        // shop_id=123&item_id=456
        /shop_id=(\d+).*item_id=(\d+)/i,

        // Ordem inversa:
        // item_id=456&shop_id=123
        /item_id=(\d+).*shop_id=(\d+)/i
    ];

    for (let index = 0; index < patterns.length; index++) {
        const match = cleanUrl.match(patterns[index]);

        if (!match) {
            continue;
        }

        if (index === 3) {
            return {
                shopId: match[2],
                itemId: match[1]
            };
        }

        return {
            shopId: match[1],
            itemId: match[2]
        };
    }

    return {
        shopId: null,
        itemId: null
    };
}


// ============================================================
// SEGUE REDIRECIONAMENTO DE LINK CURTO
// ============================================================

async function resolveShopeeUrl(url) {
    const cleanUrl = normalizeUrl(url);

    let parsedUrl;

    try {
        parsedUrl = new URL(cleanUrl);
    } catch {
        throw new Error('URL inválida.');
    }

    const host = parsedUrl.hostname.toLowerCase();

    const isShortLink =
        host === 's.shopee.com.br' ||
        host === 'shope.ee';

    if (!isShortLink) {
        return cleanUrl;
    }

    console.log('Link curto detectado.');
    console.log('Resolvendo redirecionamento...');

    const response = await fetch(cleanUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                'AppleWebKit/537.36 Chrome/151 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(
            `Não foi possível resolver link curto. HTTP ${response.status}`
        );
    }

    return response.url;
}


// ============================================================
// CONSULTA GRAPHQL
// ============================================================

async function fetchProductOfferByItemId(itemId) {
    if (!itemId) {
        throw new Error('itemId não informado.');
    }

    const query = `
        query {
            productOfferV2(
                itemId: ${itemId}
                page: 1
                limit: 1
            ) {
                nodes {
                    itemId
                    productName
                    price
                    commissionRate
                    imageUrl
                    offerLink
                    shopName
                }
                pageInfo {
                    scrollId
                    hasNextPage
                }
            }
        }
    `;

    const body = {
        query
    };

    const payload = JSON.stringify(body);

    const {
        authorization
    } = createShopeeAuthorization(payload);

    const response = await fetch(
        SHOPEE_API_ENDPOINT,
        {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                Authorization: authorization
            },

            body: payload
        }
    );

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(
            `Shopee API retornou HTTP ${response.status}: ${responseText}`
        );
    }

    let json;

    try {
        json = JSON.parse(responseText);
    } catch {
        throw new Error(
            'Resposta da Shopee não é um JSON válido.'
        );
    }

    if (json.errors && json.errors.length > 0) {
        const messages = json.errors
            .map(error => error.message)
            .join(' | ');

        throw new Error(
            `Erro GraphQL: ${messages}`
        );
    }

    const offer =
        json?.data?.productOfferV2;

    if (!offer) {
        throw new Error(
            'productOfferV2 não retornou dados.'
        );
    }

    const products =
        Array.isArray(offer.nodes)
            ? offer.nodes
            : [];

    if (products.length === 0) {
        throw new Error(
            `Nenhum produto encontrado para itemId ${itemId}.`
        );
    }

    return {
        product: products[0],
        pageInfo: offer.pageInfo || null
    };
}


// ============================================================
// NORMALIZA RETORNO PARA MODELO INTERNO
// ============================================================

function normalizeApiProduct({
    apiProduct,
    originalUrl,
    resolvedUrl,
    shopId,
    itemId
}) {
    if (!apiProduct) {
        throw new Error(
            'Produto da API não informado para normalização.'
        );
    }

    const price = Number(apiProduct.price);

    const commissionRate =
        apiProduct.commissionRate === null ||
        apiProduct.commissionRate === undefined
            ? null
            : Number(apiProduct.commissionRate);

    return {
        source: 'shopee_api',

        marketplace: 'shopee',

        itemId:
            String(apiProduct.itemId || itemId),

        shopId:
            shopId
                ? String(shopId)
                : null,

        title:
            apiProduct.productName || '',

        price:
            Number.isFinite(price)
                ? price
                : null,

        originalPrice: null,

        minPrice:
            Number.isFinite(price)
                ? price
                : null,

        maxPrice:
            Number.isFinite(price)
                ? price
                : null,

        currency: 'BRL',

        image:
            apiProduct.imageUrl || '',

        video: null,

        shopName:
            apiProduct.shopName || '',

        commissionRate:
            Number.isFinite(commissionRate)
                ? commissionRate
                : null,

        category1: null,
        category2: null,
        category3: null,

        originalUrl,

        resolvedUrl,

        affiliateLink:
            apiProduct.offerLink || '',

        available: null
    };
}


// ============================================================
// FLUXO COMPLETO
// URL -> IDs -> API -> NORMALIZAÇÃO
// ============================================================

async function getShopeeProductFromUrl(inputUrl) {
    const originalUrl = normalizeUrl(inputUrl);

    let resolvedUrl = originalUrl;

    let ids = extractShopeeIds(resolvedUrl);

    if (!ids.itemId) {
        resolvedUrl =
            await resolveShopeeUrl(originalUrl);

        ids =
            extractShopeeIds(resolvedUrl);
    }

    if (!ids.itemId) {
        throw new Error(
            'Não foi possível identificar o itemId na URL da Shopee.'
        );
    }

    console.log('');
    console.log('========================================');
    console.log('SHOPEE URL -> API');
    console.log('========================================');

    console.log(`URL ORIGINAL: ${originalUrl}`);

    if (resolvedUrl !== originalUrl) {
        console.log(`URL RESOLVIDA: ${resolvedUrl}`);
    }

    console.log('');
    console.log(`SHOP ID: ${ids.shopId || 'não identificado'}`);
    console.log(`ITEM ID: ${ids.itemId}`);

    console.log('');
    console.log('Consultando productOfferV2...');

    const result =
        await fetchProductOfferByItemId(
            ids.itemId
        );

    const normalized =
        normalizeApiProduct({
            apiProduct: result.product,
            originalUrl,
            resolvedUrl,
            shopId: ids.shopId,
            itemId: ids.itemId
        });

    return {
        product: normalized,
        pageInfo: result.pageInfo
    };
}


// ============================================================
// EXECUÇÃO PELO TERMINAL
// ============================================================

async function main() {
    const inputUrl =
        process.argv
            .slice(2)
            .join(' ')
            .trim();

    if (!inputUrl) {
        console.log('');
        console.log('Uso:');
        console.log(
            'node shopee-product-url.js "URL_DO_PRODUTO_SHOPEE"'
        );
        console.log('');

        process.exitCode = 1;
        return;
    }

    try {
        const result =
            await getShopeeProductFromUrl(
                inputUrl
            );

        console.log('');
        console.log('========================================');
        console.log('PRODUTO NORMALIZADO');
        console.log('========================================');

        console.dir(
            result.product,
            {
                depth: null,
                colors: true
            }
        );

        console.log('');
        console.log('PAGE INFO:');

        console.dir(
            result.pageInfo,
            {
                depth: null,
                colors: true
            }
        );

        console.log('');
        console.log('========================================');
        console.log('TESTE CONCLUÍDO');
        console.log('========================================');
    } catch (error) {
        console.error('');
        console.error('========================================');
        console.error('ERRO');
        console.error('========================================');
        console.error(
            error.message || error
        );

        process.exitCode = 1;
    }
}


// ============================================================
// EXPORTS PARA FUTURA INTEGRAÇÃO DA VITRINE 2
// ============================================================

module.exports = {
    extractShopeeIds,
    resolveShopeeUrl,
    fetchProductOfferByItemId,
    normalizeApiProduct,
    getShopeeProductFromUrl
};


if (require.main === module) {
    main();
}
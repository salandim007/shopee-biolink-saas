const {
    getShopeeProductFromUrl
} = require('./shopee-product-url');

const {
    normalizeFeedProduct
} = require('./feed-test');


const SOURCE_TYPES = Object.freeze({
    API: 'api',
    CSV: 'csv'
});


function normalizeSourceName(value) {
    const source =
        String(value || '')
            .trim()
            .toLowerCase();

    if (
        source === 'api' ||
        source === 'shopee_api'
    ) {
        return SOURCE_TYPES.API;
    }

    if (
        source === 'csv' ||
        source === 'feed' ||
        source === 'shopee_csv'
    ) {
        return SOURCE_TYPES.CSV;
    }

    return null;
}


function validateCatalogProduct(product) {
    if (
        !product ||
        typeof product !== 'object'
    ) {
        throw new Error(
            'A fonte não retornou um produto válido.'
        );
    }

    if (!product.itemId) {
        throw new Error(
            'Produto sem itemId.'
        );
    }

    if (!product.marketplace) {
        throw new Error(
            'Produto sem marketplace.'
        );
    }

    if (!product.title) {
        throw new Error(
            'Produto sem título.'
        );
    }

    if (
        product.price === null ||
        product.price === undefined
    ) {
        throw new Error(
            'Produto sem preço.'
        );
    }

    if (!product.image) {
        throw new Error(
            'Produto sem imagem.'
        );
    }

    if (!product.affiliateLink) {
        throw new Error(
            'Produto sem link de afiliado.'
        );
    }

    return product;
}


function createProductSource(options = {}) {
    const apiAdapter =
        options.apiAdapter ||
        getShopeeProductFromUrl;

    const feedAdapter =
        options.feedAdapter ||
        normalizeFeedProduct;


    async function getFromApi(input) {
        if (
            typeof apiAdapter !==
            'function'
        ) {
            throw new Error(
                'Adapter da Shopee Affiliate API não está disponível.'
            );
        }

        if (
            !input ||
            !String(input).trim()
        ) {
            throw new Error(
                'Informe a URL do produto Shopee.'
            );
        }

        const result =
            await apiAdapter(
                String(input).trim()
            );

        const product =
            result &&
            result.product
                ? result.product
                : result;

        return validateCatalogProduct(
            product
        );
    }


    async function getFromCsv(row) {
        if (
            typeof feedAdapter !==
            'function'
        ) {
            throw new Error(
                'Adapter do Shopee Data Feed não está disponível.'
            );
        }

        if (
            !row ||
            typeof row !== 'object'
        ) {
            throw new Error(
                'Informe uma linha válida do CSV.'
            );
        }

        const product =
            await feedAdapter(row);

        return validateCatalogProduct(
            product
        );
    }


    async function getProduct(request = {}) {
        const source =
            normalizeSourceName(
                request.source
            );

        if (!source) {
            throw new Error(
                `Fonte de produto inválida: ${request.source || '(não informada)'}`
            );
        }

        if (
            source ===
            SOURCE_TYPES.API
        ) {
            return getFromApi(
                request.input
            );
        }

        if (
            source ===
            SOURCE_TYPES.CSV
        ) {
            return getFromCsv(
                request.row
            );
        }

        throw new Error(
            `Fonte não suportada: ${source}`
        );
    }


    return {
        getProduct,
        getFromApi,
        getFromCsv
    };
}


const defaultProductSource =
    createProductSource();


module.exports = {
    SOURCE_TYPES,
    normalizeSourceName,
    validateCatalogProduct,
    createProductSource,
    defaultProductSource
};
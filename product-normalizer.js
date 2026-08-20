function toNullableNumber(value) {
    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


function toNullableString(value) {
    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const text = String(value).trim();

    return text || null;
}


function normalizeMarketplace(value) {
    const marketplace =
        toNullableString(value);

    return marketplace
        ? marketplace.toLowerCase()
        : null;
}


function normalizeProduct(input = {}) {
    const price =
        toNullableNumber(input.price);

    const originalPrice =
        toNullableNumber(input.originalPrice);

    const minPrice =
        toNullableNumber(
            input.minPrice ?? price
        );

    const maxPrice =
        toNullableNumber(
            input.maxPrice ?? price
        );

    return {
        source:
            toNullableString(input.source),

        marketplace:
            normalizeMarketplace(
                input.marketplace
            ),

        itemId:
            toNullableString(
                input.itemId
            ),

        shopId:
            toNullableString(
                input.shopId
            ),

        title:
            toNullableString(
                input.title
            ),

        description:
            toNullableString(
                input.description
            ),

        price,

        originalPrice,

        minPrice,

        maxPrice,

        currency:
            toNullableString(
                input.currency
            ) || 'BRL',

        image:
            toNullableString(
                input.image
            ),

        video:
            toNullableString(
                input.video
            ),

        shopName:
            toNullableString(
                input.shopName
            ),

        commissionRate:
            toNullableNumber(
                input.commissionRate
            ),

        category1:
            toNullableString(
                input.category1
            ),

        category2:
            toNullableString(
                input.category2
            ),

        category3:
            toNullableString(
                input.category3
            ),

        originalUrl:
            toNullableString(
                input.originalUrl
            ),

        resolvedUrl:
            toNullableString(
                input.resolvedUrl
            ),

        affiliateLink:
            toNullableString(
                input.affiliateLink
            ),

        available:
            typeof input.available === 'boolean'
                ? input.available
                : null,

        metadata:
            input.metadata &&
            typeof input.metadata === 'object'
                ? input.metadata
                : {}
    };
}


function validateNormalizedProduct(product) {
    const errors = [];

    if (!product) {
        return [
            'Produto não informado.'
        ];
    }

    if (!product.marketplace) {
        errors.push(
            'marketplace é obrigatório.'
        );
    }

    if (!product.itemId) {
        errors.push(
            'itemId é obrigatório.'
        );
    }

    if (!product.title) {
        errors.push(
            'title é obrigatório.'
        );
    }

    if (
        product.price === null ||
        product.price < 0
    ) {
        errors.push(
            'price deve possuir valor válido.'
        );
    }

    if (!product.image) {
        errors.push(
            'image é obrigatório.'
        );
    }

    if (!product.affiliateLink) {
        errors.push(
            'affiliateLink é obrigatório.'
        );
    }

    return errors;
}


function createCatalogProduct(input) {
    const product =
        normalizeProduct(input);

    const errors =
        validateNormalizedProduct(
            product
        );

    if (errors.length > 0) {
        const error =
            new Error(
                'Produto normalizado inválido.'
            );

        error.validationErrors =
            errors;

        throw error;
    }

    return product;
}


module.exports = {
    toNullableNumber,
    toNullableString,
    normalizeProduct,
    validateNormalizedProduct,
    createCatalogProduct
};
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


function normalizeStringList(value) {
    const source =
        Array.isArray(value)
            ? value
            : value === undefined ||
              value === null ||
              value === ''
                ? []
                : [value];

    const normalized = [];

    for (const item of source) {
        const text =
            toNullableString(item);

        if (
            text &&
            !normalized.includes(text)
        ) {
            normalized.push(text);
        }
    }

    return normalized;
}


function normalizeMedia({
    primary,
    list
}) {
    const primaryValue =
        toNullableString(primary);

    const items =
        normalizeStringList(list);

    if (
        primaryValue &&
        !items.includes(primaryValue)
    ) {
        items.unshift(primaryValue);
    }

    const resolvedPrimary =
        primaryValue ||
        items[0] ||
        null;

    return {
        primary:
            resolvedPrimary,

        items
    };
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

    const imageMedia =
        normalizeMedia({
            primary:
                input.image,

            list:
                input.images
        });

    const videoMedia =
        normalizeMedia({
            primary:
                input.video,

            list:
                input.videos
        });

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

        /*
         * Compatibilidade:
         * image continua sendo a imagem principal usada
         * pelas telas e fluxos existentes.
         *
         * images passa a guardar a galeria completa.
         */
        image:
            imageMedia.primary,

        images:
            imageMedia.items,

        /*
         * Compatibilidade:
         * video continua sendo o vídeo principal.
         *
         * videos deixa o catálogo preparado para receber
         * mais de um vídeo no futuro, caso a fonte ofereça.
         */
        video:
            videoMedia.primary,

        videos:
            videoMedia.items,

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
    normalizeMarketplace,
    normalizeStringList,
    normalizeMedia,
    normalizeProduct,
    validateNormalizedProduct,
    createCatalogProduct
};

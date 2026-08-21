function cloneMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
        return {};
    }

    return {
        ...metadata
    };
}


function toPublicProduct(product) {
    if (!product || typeof product !== 'object') {
        throw new Error(
            'Produto inválido para conversão pública.'
        );
    }

    const publicProduct = {
        source: product.source ?? null,
        marketplace: product.marketplace ?? null,

        itemId: product.itemId ?? null,
        shopId: product.shopId ?? null,

        title: product.title ?? null,
        description: product.description ?? null,

        price: product.price ?? null,
        originalPrice: product.originalPrice ?? null,
        minPrice: product.minPrice ?? null,
        maxPrice: product.maxPrice ?? null,
        currency: product.currency ?? 'BRL',

        image: product.image ?? null,
        video: product.video ?? null,

        shopName: product.shopName ?? null,

        category1: product.category1 ?? null,
        category2: product.category2 ?? null,
        category3: product.category3 ?? null,

        affiliateLink: product.affiliateLink ?? null,

        available: product.available ?? null,

        metadata: cloneMetadata(
            product.metadata
        )
    };

    return publicProduct;
}


function toPublicCatalogEntry(entry) {
    if (
        !entry ||
        typeof entry !== 'object' ||
        !entry.product
    ) {
        throw new Error(
            'Entrada de catálogo inválida.'
        );
    }

    return {
        product:
            toPublicProduct(
                entry.product
            ),

        visibility: {
            published:
                Boolean(
                    entry.visibility?.published
                ),

            featured:
                Boolean(
                    entry.visibility?.featured
                ),

            position:
                entry.visibility?.position ??
                null
        },

        collections:
            Array.isArray(
                entry.collections
            )
                ? [...entry.collections]
                : []
    };
}


function toPublicCatalogEntries(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }

    const {
    toPublicCatalogEntries
} = require('./vitrine2-public-product');

    return entries.map(
        toPublicCatalogEntry
    );
}


module.exports = {
    toPublicProduct,
    toPublicCatalogEntry,
    toPublicCatalogEntries
};
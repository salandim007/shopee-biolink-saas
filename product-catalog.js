const DEFAULT_VISIBILITY = Object.freeze({
    published: false,
    featured: false,
    position: null
});


function normalizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (value === 1 || value === '1') {
        return true;
    }

    if (value === 0 || value === '0') {
        return false;
    }

    return fallback;
}


function normalizePosition(value) {
    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return null;
    }

    const position =
        Number(value);

    if (
        !Number.isInteger(position) ||
        position < 1
    ) {
        return null;
    }

    return position;
}


function createCatalogEntry({
    product,
    published =
        DEFAULT_VISIBILITY.published,
    featured =
        DEFAULT_VISIBILITY.featured,
    position =
        DEFAULT_VISIBILITY.position,
    collections = []
} = {}) {
    if (
        !product ||
        typeof product !== 'object'
    ) {
        throw new Error(
            'Produto inválido para o catálogo.'
        );
    }

    if (!product.itemId) {
        throw new Error(
            'Produto do catálogo sem itemId.'
        );
    }

    if (!product.marketplace) {
        throw new Error(
            'Produto do catálogo sem marketplace.'
        );
    }

    const normalizedCollections =
        Array.isArray(collections)
            ? [
                ...new Set(
                    collections
                        .map(value =>
                            String(value || '')
                                .trim()
                                .toLowerCase()
                        )
                        .filter(Boolean)
                )
            ]
            : [];

    return {
        product,

        visibility: {
            published:
                normalizeBoolean(
                    published,
                    false
                ),

            featured:
                normalizeBoolean(
                    featured,
                    false
                ),

            position:
                normalizePosition(
                    position
                )
        },

        collections:
            normalizedCollections
    };
}


class ProductCatalog {
    constructor() {
        this.entries =
            new Map();
    }


    createKey(product) {
        if (
            !product ||
            !product.marketplace ||
            !product.itemId
        ) {
            throw new Error(
                'Não foi possível criar a chave do produto.'
            );
        }

        return (
            `${product.marketplace}:${product.itemId}`
        );
    }


    addProduct(
        product,
        options = {}
    ) {
        const entry =
            createCatalogEntry({
                product,
                ...options
            });

        const key =
            this.createKey(
                product
            );

        this.entries.set(
            key,
            entry
        );

        return entry;
    }


    hasProduct(product) {
        const key =
            this.createKey(
                product
            );

        return this.entries.has(
            key
        );
    }


    getProduct(
        marketplace,
        itemId
    ) {
        const key =
            `${String(
                marketplace || ''
            ).toLowerCase()}:${String(
                itemId || ''
            )}`;

        return (
            this.entries.get(key) ||
            null
        );
    }


    setPublished(
        marketplace,
        itemId,
        published
    ) {
        const entry =
            this.getProduct(
                marketplace,
                itemId
            );

        if (!entry) {
            throw new Error(
                'Produto não encontrado no catálogo.'
            );
        }

        entry.visibility.published =
            normalizeBoolean(
                published,
                false
            );

        return entry;
    }


    setFeatured(
        marketplace,
        itemId,
        featured
    ) {
        const entry =
            this.getProduct(
                marketplace,
                itemId
            );

        if (!entry) {
            throw new Error(
                'Produto não encontrado no catálogo.'
            );
        }

        entry.visibility.featured =
            normalizeBoolean(
                featured,
                false
            );

        return entry;
    }


    setPosition(
        marketplace,
        itemId,
        position
    ) {
        const entry =
            this.getProduct(
                marketplace,
                itemId
            );

        if (!entry) {
            throw new Error(
                'Produto não encontrado no catálogo.'
            );
        }

        entry.visibility.position =
            normalizePosition(
                position
            );

        return entry;
    }


    addToCollection(
        marketplace,
        itemId,
        collection
    ) {
        const entry =
            this.getProduct(
                marketplace,
                itemId
            );

        if (!entry) {
            throw new Error(
                'Produto não encontrado no catálogo.'
            );
        }

        const normalizedCollection =
            String(
                collection || ''
            )
                .trim()
                .toLowerCase();

        if (!normalizedCollection) {
            throw new Error(
                'Coleção inválida.'
            );
        }

        if (
            !entry.collections.includes(
                normalizedCollection
            )
        ) {
            entry.collections.push(
                normalizedCollection
            );
        }

        return entry;
    }


    removeFromCollection(
        marketplace,
        itemId,
        collection
    ) {
        const entry =
            this.getProduct(
                marketplace,
                itemId
            );

        if (!entry) {
            throw new Error(
                'Produto não encontrado no catálogo.'
            );
        }

        const normalizedCollection =
            String(
                collection || ''
            )
                .trim()
                .toLowerCase();

        entry.collections =
            entry.collections.filter(
                value =>
                    value !==
                    normalizedCollection
            );

        return entry;
    }


    listAll() {
        return [
            ...this.entries.values()
        ];
    }


    listPublished() {
        return this
            .listAll()
            .filter(
                entry =>
                    entry.visibility.published
            )
            .sort(
                (a, b) => {
                    const positionA =
                        a.visibility.position ??
                        Number.MAX_SAFE_INTEGER;

                    const positionB =
                        b.visibility.position ??
                        Number.MAX_SAFE_INTEGER;

                    return (
                        positionA -
                        positionB
                    );
                }
            );
    }


    listFeatured() {
        return this
            .listPublished()
            .filter(
                entry =>
                    entry.visibility.featured
            );
    }


    listByCollection(
        collection
    ) {
        const normalizedCollection =
            String(
                collection || ''
            )
                .trim()
                .toLowerCase();

        return this
            .listPublished()
            .filter(
                entry =>
                    entry.collections.includes(
                        normalizedCollection
                    )
            );
    }


    removeProduct(
        marketplace,
        itemId
    ) {
        const key =
            `${String(
                marketplace || ''
            ).toLowerCase()}:${String(
                itemId || ''
            )}`;

        return this.entries.delete(
            key
        );
    }


    clear() {
        this.entries.clear();
    }
}


function createProductCatalog() {
    return new ProductCatalog();
}


module.exports = {
    DEFAULT_VISIBILITY,
    normalizeBoolean,
    normalizePosition,
    createCatalogEntry,
    ProductCatalog,
    createProductCatalog
};
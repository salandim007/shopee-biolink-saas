const DEFAULT_VISIBILITY = Object.freeze({
    published: false,
    featured: false,
    position: null
});


const DEFAULT_MARKETING = Object.freeze({
    selected: false,
    selectedAt: null,
    status: 'not_selected'
});


const MARKETING_STATUSES = Object.freeze([
    'not_selected',
    'selected',
    'preparing',
    'scheduled',
    'published',
    'error'
]);


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


function normalizeMarketingStatus(
    value,
    fallback =
        DEFAULT_MARKETING.status
) {
    const status =
        String(
            value || ''
        )
            .trim()
            .toLowerCase();

    if (
        MARKETING_STATUSES.includes(
            status
        )
    ) {
        return status;
    }

    return fallback;
}


function normalizeSelectedAt(value) {
    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return null;
    }

    const date =
        new Date(
            value
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date.toISOString();
}


function normalizeMarketing(
    marketing = {}
) {
    const source =
        marketing &&
        typeof marketing === 'object'
            ? marketing
            : {};

    const selected =
        normalizeBoolean(
            source.selected,
            DEFAULT_MARKETING.selected
        );

    let status =
        normalizeMarketingStatus(
            source.status,
            selected
                ? 'selected'
                : 'not_selected'
        );

    let selectedAt =
        normalizeSelectedAt(
            source.selectedAt
        );

    if (!selected) {
        status =
            'not_selected';

        selectedAt =
            null;
    }
    else {
        if (
            status ===
            'not_selected'
        ) {
            status =
                'selected';
        }

        if (!selectedAt) {
            selectedAt =
                new Date()
                    .toISOString();
        }
    }

    return {
        selected,
        selectedAt,
        status
    };
}


function createCatalogEntry({
    product,
    published =
        DEFAULT_VISIBILITY.published,
    featured =
        DEFAULT_VISIBILITY.featured,
    position =
        DEFAULT_VISIBILITY.position,
    collections = [],
    marketing =
        DEFAULT_MARKETING
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
            normalizedCollections,

        marketing:
            normalizeMarketing(
                marketing
            )
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
            `${String(
                product.marketplace
            ).toLowerCase()}:${String(
                product.itemId
            )}`
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


    setMarketingSelected(
        marketplace,
        itemId,
        selected
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

        const normalizedSelected =
            normalizeBoolean(
                selected,
                false
            );

        entry.marketing =
            normalizeMarketing({
                ...entry.marketing,

                selected:
                    normalizedSelected,

                selectedAt:
                    normalizedSelected
                        ? (
                            entry.marketing
                                ?.selectedAt ||
                            new Date()
                                .toISOString()
                        )
                        : null,

                status:
                    normalizedSelected
                        ? (
                            entry.marketing
                                ?.status ===
                            'not_selected'
                                ? 'selected'
                                : (
                                    entry.marketing
                                        ?.status ||
                                    'selected'
                                )
                        )
                        : 'not_selected'
            });

        return entry;
    }


    setMarketingStatus(
        marketplace,
        itemId,
        status
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

        const normalizedStatus =
            normalizeMarketingStatus(
                status
            );

        const selected =
            normalizedStatus !==
            'not_selected';

        entry.marketing =
            normalizeMarketing({
                ...entry.marketing,

                selected,

                selectedAt:
                    selected
                        ? (
                            entry.marketing
                                ?.selectedAt ||
                            new Date()
                                .toISOString()
                        )
                        : null,

                status:
                    normalizedStatus
            });

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


    listMarketingSelected() {
        return this
            .listAll()
            .filter(
                entry =>
                    entry.marketing
                        ?.selected ===
                    true
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
    DEFAULT_MARKETING,
    MARKETING_STATUSES,
    normalizeBoolean,
    normalizePosition,
    normalizeMarketingStatus,
    normalizeSelectedAt,
    normalizeMarketing,
    createCatalogEntry,
    ProductCatalog,
    createProductCatalog
};

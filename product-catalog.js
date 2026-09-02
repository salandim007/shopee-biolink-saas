const DEFAULT_VISIBILITY = Object.freeze({
    published: false,
    featured: false,
    position: null
});


const DEFAULT_MARKETING_CHANNELS = Object.freeze({
    instagram: false,
    facebook: false,
    tiktok: false,
    kwai: false,
    outros: false
});


const DEFAULT_MARKETING_POLICIES = Object.freeze({
    instagram: null
});


const DEFAULT_MARKETING = Object.freeze({
    selected: false,
    selectedAt: null,
    status: 'not_selected',
    channels: DEFAULT_MARKETING_CHANNELS,
    policies: DEFAULT_MARKETING_POLICIES
});


const MARKETING_CHANNELS = Object.freeze([
    'instagram',
    'facebook',
    'tiktok',
    'kwai',
    'outros'
]);


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


function normalizeMarketingChannel(value) {
    const channel =
        String(
            value || ''
        )
            .trim()
            .toLowerCase();

    if (
        !MARKETING_CHANNELS.includes(
            channel
        )
    ) {
        throw new Error(
            'Canal de Marketing inválido.'
        );
    }

    return channel;
}


function normalizeMarketingChannels(
    channels = {}
) {
    const source =
        channels &&
        typeof channels === 'object'
            ? channels
            : {};

    return {
        instagram:
            normalizeBoolean(
                source.instagram,
                DEFAULT_MARKETING_CHANNELS.instagram
            ),

        facebook:
            normalizeBoolean(
                source.facebook,
                DEFAULT_MARKETING_CHANNELS.facebook
            ),

        tiktok:
            normalizeBoolean(
                source.tiktok,
                DEFAULT_MARKETING_CHANNELS.tiktok
            ),

        kwai:
            normalizeBoolean(
                source.kwai,
                DEFAULT_MARKETING_CHANNELS.kwai
            ),

        outros:
            normalizeBoolean(
                source.outros,
                DEFAULT_MARKETING_CHANNELS.outros
            )
    };
}


function normalizePolicyStatus(value) {
    const status =
        String(
            value || ''
        )
            .trim()
            .toLowerCase();

    const allowed = [
        'approved',
        'needs_review',
        'blocked',
        'revalidate',
        'unavailable'
    ];

    return allowed.includes(status)
        ? status
        : null;
}


function normalizePolicyDate(value) {
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


function normalizeMarketingPolicy(
    policy
) {
    if (
        !policy ||
        typeof policy !== 'object'
    ) {
        return null;
    }

    const status =
        normalizePolicyStatus(
            policy.status
        );

    if (!status) {
        return null;
    }

    const policyVersion =
        policy.policyVersion === undefined ||
        policy.policyVersion === null ||
        policy.policyVersion === ''
            ? null
            : String(
                policy.policyVersion
            ).trim();

    const reason =
        policy.reason === undefined ||
        policy.reason === null ||
        policy.reason === ''
            ? null
            : String(
                policy.reason
            ).trim();

    return {
        status,

        policyVersion,

        reason,

        validatedAt:
            normalizePolicyDate(
                policy.validatedAt
            ) ||
            new Date()
                .toISOString(),

        decision:
            policy.decision &&
            typeof policy.decision === 'object'
                ? policy.decision
                : null,

        summary:
            policy.summary &&
            typeof policy.summary === 'object'
                ? policy.summary
                : null
    };
}


function normalizeMarketingPolicies(
    policies = {}
) {
    const source =
        policies &&
        typeof policies === 'object'
            ? policies
            : {};

    return {
        instagram:
            normalizeMarketingPolicy(
                source.instagram
            )
    };
}


function normalizeMarketing(
    marketing = {}
) {
    const source =
        marketing &&
        typeof marketing === 'object'
            ? marketing
            : {};

    const channels =
        normalizeMarketingChannels(
            source.channels
        );

    const policies =
        normalizeMarketingPolicies(
            source.policies
        );

    /*
     * A seleção de Marketing é consequência dos canais.
     *
     * Com pelo menos um canal marcado, o produto está
     * selecionado. Sem canais marcados, ele volta para
     * not_selected.
     */
    const selected =
        Object.values(
            channels
        ).some(Boolean);

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
        status,
        channels,
        policies
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

        const currentChannels =
            normalizeMarketingChannels(
                entry.marketing
                    ?.channels
            );

        const hasEnabledChannel =
            Object.values(
                currentChannels
            ).some(Boolean);

        if (
            normalizedSelected &&
            !hasEnabledChannel
        ) {
            throw new Error(
                'Selecione pelo menos um canal de Marketing.'
            );
        }

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
                        : 'not_selected',

                channels:
                    normalizedSelected
                        ? currentChannels
                        : DEFAULT_MARKETING_CHANNELS
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


    setMarketingChannel(
        marketplace,
        itemId,
        channel,
        enabled
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

        const normalizedChannel =
            normalizeMarketingChannel(
                channel
            );

        const normalizedEnabled =
            normalizeBoolean(
                enabled,
                false
            );

        entry.marketing =
            normalizeMarketing({
                ...entry.marketing,

                channels: {
                    ...entry.marketing
                        ?.channels,

                    [normalizedChannel]:
                        normalizedEnabled
                }
            });

        return entry;
    }


    setMarketingPolicy(
        marketplace,
        itemId,
        channel,
        policy
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

        const normalizedChannel =
            normalizeMarketingChannel(
                channel
            );

        if (
            normalizedChannel !==
            'instagram'
        ) {
            throw new Error(
                'Policy Engine ainda não disponível para este canal.'
            );
        }

        const normalizedPolicy =
            normalizeMarketingPolicy(
                policy
            );

        entry.marketing =
            normalizeMarketing({
                ...entry.marketing,

                policies: {
                    ...entry.marketing
                        ?.policies,

                    [normalizedChannel]:
                        normalizedPolicy
                }
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


    listMarketingByChannel(
        channel
    ) {
        const normalizedChannel =
            normalizeMarketingChannel(
                channel
            );

        return this
            .listAll()
            .filter(
                entry =>
                    entry.marketing
                        ?.channels
                        ?.[normalizedChannel] ===
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
    DEFAULT_MARKETING_CHANNELS,
    DEFAULT_MARKETING_POLICIES,
    DEFAULT_MARKETING,
    MARKETING_CHANNELS,
    MARKETING_STATUSES,
    normalizeBoolean,
    normalizePosition,
    normalizeMarketingStatus,
    normalizeSelectedAt,
    normalizeMarketingChannel,
    normalizeMarketingChannels,
    normalizePolicyStatus,
    normalizePolicyDate,
    normalizeMarketingPolicy,
    normalizeMarketingPolicies,
    normalizeMarketing,
    createCatalogEntry,
    ProductCatalog,
    createProductCatalog
};
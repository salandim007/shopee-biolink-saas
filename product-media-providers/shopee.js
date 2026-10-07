'use strict';

const {
    defaultCatalogStore
} = require('../product-catalog-store');

const {
    createProductMediaLibrary
} = require('../product-media-library');

const productMediaService =
    require('../product-media-service');

const {
    extractShopeeIds,
    resolveShopeeUrl,
    getShopeeProductFromUrl
} = require('../shopee-product-url');

const {
    captureShopeeMedia
} = require('../shopee-browser-media-capture');


const MARKETPLACE = 'shopee';


function text(value) {
    const result =
        String(
            value ?? ''
        ).trim();

    return result || null;
}


function unique(values) {
    return [
        ...new Set(
            (Array.isArray(values)
                ? values
                : []
            )
                .map(text)
                .filter(Boolean)
        )
    ];
}


function normalizeMinImages(value) {
    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number < 1
    ) {
        return 5;
    }

    return Math.min(
        Math.floor(number),
        20
    );
}


function canHandle(input = {}) {
    const marketplace =
        text(input.marketplace);

    if (
        marketplace &&
        marketplace.toLowerCase() ===
            MARKETPLACE
    ) {
        return true;
    }

    const url =
        text(input.url);

    if (!url) {
        return false;
    }

    return /shopee/i.test(url);
}


async function resolveIdentity(url) {
    const originalUrl =
        text(url);

    if (!originalUrl) {
        throw new Error(
            'Informe o link do produto Shopee.'
        );
    }

    let resolvedUrl =
        originalUrl;

    let ids =
        extractShopeeIds(
            resolvedUrl
        );

    if (!ids?.itemId) {
        resolvedUrl =
            await resolveShopeeUrl(
                originalUrl
            );

        ids =
            extractShopeeIds(
                resolvedUrl
            );
    }

    const itemId =
        text(ids?.itemId);

    const shopId =
        text(ids?.shopId);

    if (!itemId) {
        throw new Error(
            'Não foi possível identificar o itemId do produto Shopee.'
        );
    }

    return {
        marketplace:
            MARKETPLACE,

        originalUrl,

        resolvedUrl,

        itemId,

        shopId
    };
}


function createContext(minImages) {
    const catalog =
        defaultCatalogStore.load();

    const library =
        createProductMediaLibrary({
            catalog,
            store:
                defaultCatalogStore,
            minImages
        });

    return {
        catalog,
        library
    };
}


function getState(
    library,
    itemId,
    minImages
) {
    try {
        return library.getMediaState(
            MARKETPLACE,
            itemId,
            {
                minImages
            }
        );
    } catch {
        return null;
    }
}


async function getProductMedia(
    input = {}
) {
    const minImages =
        normalizeMinImages(
            input.minImages
        );

    const allowEnrichment =
        input.enrich !== false;

    const identity =
        await resolveIdentity(
            input.url
        );

    const {
        catalog,
        library
    } = createContext(
        minImages
    );

    let entry =
        catalog.getProduct(
            MARKETPLACE,
            identity.itemId
        );

    let state =
        entry
            ? getState(
                library,
                identity.itemId,
                minImages
            )
            : null;

    let shopId =
        identity.shopId ||
        text(
            entry?.product?.shopId
        );

    let feedProduct = null;

    let usedFeed = false;
    let captureAttempted = false;
    let captured = false;

    const warnings = [];


    /*
     * PLANO A
     *
     * O produto já existe no nosso
     * acervo persistente.
     *
     * Se houver imagens suficientes
     * e já conhecermos o shopId,
     * não consulta mais nada.
     */


    /*
     * PLANO B
     *
     * Complementa através do catálogo/feed
     * que já existe no catalog.sqlite.
     */
    if (
        !state ||
        state.imageCount < minImages ||
        !shopId
    ) {
        try {
            feedProduct =
                await productMediaService
                    .getProductByItemId(
                        identity.itemId,
                        {
                            shopId:
                                shopId ||
                                undefined
                        }
                    );

            if (feedProduct) {
                usedFeed = true;

                shopId =
                    shopId ||
                    text(
                        feedProduct.shopId
                    );

                if (!entry) {
                    entry =
                        catalog.addProduct(
                            feedProduct
                        );

                    defaultCatalogStore
                        .save(
                            catalog
                        );
                } else {
                    const feedImages =
                        unique(
                            feedProduct.images
                        );

                    const feedVideos =
                        unique(
                            feedProduct.videos
                        );

                    if (
                        feedImages.length ||
                        feedVideos.length
                    ) {
                        library.saveMedia(
                            MARKETPLACE,
                            identity.itemId,
                            {
                                images:
                                    feedImages,

                                videos:
                                    feedVideos
                            },
                            {
                                minImages
                            }
                        );
                    }
                }

                state =
                    getState(
                        library,
                        identity.itemId,
                        minImages
                    );
            }
        } catch (error) {
            warnings.push(
                `Feed: ${
                    error?.message ||
                    error
                }`
            );
        }
    }


    if (!entry) {
        try {
            const apiResult =
                await getShopeeProductFromUrl(
                    identity.resolvedUrl ||
                    input.url
                );

            const apiProduct =
                apiResult?.product || null;

            if (apiProduct) {
                apiProduct.images =
                    unique([
                        ...(apiProduct.images || []),
                        apiProduct.image
                    ]);

                apiProduct.videos =
                    unique(
                        apiProduct.videos || []
                    );

                entry =
                    catalog.addProduct(
                        apiProduct
                    );

                defaultCatalogStore.save(
                    catalog
                );

                shopId =
                    shopId ||
                    text(apiProduct.shopId);

                state =
                    getState(
                        library,
                        identity.itemId,
                        minImages
                    );
            }
        } catch (error) {
            warnings.push(
                `Affiliate API: ${
                    error?.message || error
                }`
            );
        }
    }

    if (!entry) {
        throw new Error(
            'Produto não encontrado no acervo, feed ou Affiliate API.'
        );
    }


    /*
     * PLANO C
     *
     * Se ainda houver poucas fotos,
     * captura/enriquece pela Shopee.
     *
     * O resultado é salvo no mesmo
     * acervo persistente.
     */
    if (
        allowEnrichment &&
        (
            !state ||
            state.imageCount < minImages
        )
    ) {
        if (
            shopId &&
            /^\d+$/.test(shopId)
        ) {
            captureAttempted = true;

            try {
                const report =
                    await captureShopeeMedia(
                        shopId,
                        identity.itemId
                    );

                const capturedImages =
                    unique(
                        report?.images
                    );

                const capturedVideos =
                    unique(
                        report?.videos
                    );

                if (
                    capturedImages.length ||
                    capturedVideos.length
                ) {
                    library.saveMedia(
                        MARKETPLACE,
                        identity.itemId,
                        {
                            images:
                                capturedImages,

                            videos:
                                capturedVideos,

                            source:
                                'shopee_browser_capture',

                            capturedAt:
                                new Date()
                                    .toISOString()
                        },
                        {
                            minImages
                        }
                    );

                    captured = true;
                }

                state =
                    getState(
                        library,
                        identity.itemId,
                        minImages
                    );
            } catch (error) {
                warnings.push(
                    `Captura Shopee: ${
                        error?.message ||
                        error
                    }`
                );
            }
        } else {
            warnings.push(
                'Captura Shopee não executada: shopId não disponível.'
            );
        }
    }


    state =
        state ||
        getState(
            library,
            identity.itemId,
            minImages
        );


    if (!state) {
        throw new Error(
            'Não foi possível carregar as mídias do produto.'
        );
    }


    const finalEntry =
        catalog.getProduct(
            MARKETPLACE,
            identity.itemId
        );

    const product =
        finalEntry?.product ||
        feedProduct ||
        {};


    return {
        marketplace:
            MARKETPLACE,

        provider:
            'shopee',

        itemId:
            identity.itemId,

        shopId:
            shopId ||
            text(product.shopId),

        title:
            text(product.title),

        originalUrl:
            identity.originalUrl,

        resolvedUrl:
            identity.resolvedUrl,

        image:
            state.image,

        images:
            state.images,

        video:
            state.video,

        videos:
            state.videos,

        imageCount:
            state.imageCount,

        videoCount:
            state.videoCount,

        requiredImages:
            state.requiredImages,

        hasEnoughImages:
            state.hasEnoughImages,

        needsEnrichment:
            state.needsEnrichment,

        enrichment: {
            allowed:
                allowEnrichment,

            feedUsed:
                usedFeed,

            captureAttempted,

            captured
        },

        warnings
    };
}


module.exports = {
    marketplace:
        MARKETPLACE,

    canHandle,

    resolveIdentity,

    getProductMedia
};

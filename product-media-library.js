'use strict';


const DEFAULT_MIN_IMAGES = 3;

// Recursos da pagina Shopee confirmados como indevidos.
// Nao pertencem as galerias dos produtos.
const BLOCKED_IMAGE_IDS = new Set([
    'br-11134233-820m9-mt9i4ccwhhq881',
    'aed1aaab6a81b4347b440d981f0cf76f',
    '531a1a0e62d0f9875a56390970e5a845',
    'br-11134258-7r98o-m9rsxkghyiv667',
    '33b3213444ab1fa40c1eb7abf8b91b11',
    'ddf4fb18c6fa5e2d73459a7a7ea0953b',
    '27788e45f5489f39ef1e774e9bbedb6f',
    '2c0f5bda4ce39caff001e7ccec309bc6',
    '3b43f8cafbf943868154166639011597'
]);

function isAllowedProductImage(value) {
    try {
        const url = new URL(String(value));
        const filename = url.pathname.split('/').pop()
            .replace(/@resize_w\d+_nl(?:\.webp)?$/i, '')
            .replace(/_tn$/i, '');

        return !BLOCKED_IMAGE_IDS.has(filename);
    } catch {
        return false;
    }
}


function normalizeText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return '';
    }

    return String(value).trim();
}


function normalizeUrl(value) {
    const url =
        normalizeText(value);

    if (!url) {
        return null;
    }

    return url;
}


function normalizeUrlList(value) {
    const values =
        Array.isArray(value)
            ? value
            : (
                value
                    ? [value]
                    : []
            );

    const unique =
        new Set();

    for (
        const item
        of values
    ) {
        const url =
            normalizeUrl(item);

        if (!url) {
            continue;
        }

        unique.add(url);
    }

    return [
        ...unique
    ];
}


function mergeUrlLists(...lists) {
    const unique =
        new Set();

    for (
        const list
        of lists
    ) {
        for (
            const url
            of normalizeUrlList(list)
        ) {
            unique.add(url);
        }
    }

    return [
        ...unique
    ];
}


function normalizeMinimumImages(
    value,
    fallback =
        DEFAULT_MIN_IMAGES
) {
    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number < 1
    ) {
        return fallback;
    }

    return Math.floor(number);
}


function createProductMediaLibrary(
    options = {}
) {
    const catalog =
        options.catalog;

    const store =
        options.store ||
        null;

    const minImages =
        normalizeMinimumImages(
            options.minImages
        );


    if (
        !catalog ||
        typeof catalog.getProduct !==
            'function'
    ) {
        throw new Error(
            'Catálogo inválido para a biblioteca de mídia.'
        );
    }


    function getEntry(
        marketplace,
        itemId
    ) {
        const normalizedMarketplace =
            normalizeText(
                marketplace
            ).toLowerCase();

        const normalizedItemId =
            normalizeText(
                itemId
            );

        if (
            !normalizedMarketplace ||
            !normalizedItemId
        ) {
            throw new Error(
                'Marketplace e itemId são obrigatórios.'
            );
        }

        const entry =
            catalog.getProduct(
                normalizedMarketplace,
                normalizedItemId
            );

        if (!entry) {
            throw new Error(
                'Produto não encontrado no catálogo.'
            );
        }

        if (!entry.product) {
            throw new Error(
                'Entrada do catálogo sem produto.'
            );
        }

        return entry;
    }


    function getMediaState(
        marketplace,
        itemId,
        stateOptions = {}
    ) {
        const entry =
            getEntry(
                marketplace,
                itemId
            );

        const product =
            entry.product;

        const requiredImages =
            normalizeMinimumImages(
                stateOptions.minImages,
                minImages
            );

        const images =
            mergeUrlLists(
                product.image,
                product.images
            );

        const videos =
            mergeUrlLists(
                product.video,
                product.videos
            );

        const media =
            (
                product.media &&
                typeof product.media ===
                    'object'
            )
                ? {
                    ...product.media
                }
                : {};

        return {
            marketplace:
                normalizeText(
                    product.marketplace ||
                    marketplace
                ).toLowerCase(),

            itemId:
                normalizeText(
                    product.itemId ||
                    itemId
                ),

            image:
                images[0] ||
                null,

            images,

            video:
                videos[0] ||
                null,

            videos,

            imageCount:
                images.length,

            videoCount:
                videos.length,

            requiredImages,

            hasEnoughImages:
                images.length >=
                requiredImages,

            needsEnrichment:
                images.length <
                requiredImages,

            media
        };
    }


    function hasEnoughMedia(
        marketplace,
        itemId,
        stateOptions = {}
    ) {
        return getMediaState(
            marketplace,
            itemId,
            stateOptions
        ).hasEnoughImages;
    }


    function needsEnrichment(
        marketplace,
        itemId,
        stateOptions = {}
    ) {
        return !hasEnoughMedia(
            marketplace,
            itemId,
            stateOptions
        );
    }


    function persist() {
        if (
            !store ||
            typeof store.save !==
                'function'
        ) {
            return null;
        }

        return store.save(
            catalog
        );
    }


    function saveMedia(
        marketplace,
        itemId,
        mediaInput = {},
        saveOptions = {}
    ) {
        const entry =
            getEntry(
                marketplace,
                itemId
            );

        const product =
            entry.product;

        const previousImages =
            mergeUrlLists(
                product.image,
                product.images
            );

        const previousVideos =
            mergeUrlLists(
                product.video,
                product.videos
            );

        const incomingImages =
            mergeUrlLists(
                mediaInput.image,
                mediaInput.images
            ).filter(isAllowedProductImage);

        const incomingVideos =
            mergeUrlLists(
                mediaInput.video,
                mediaInput.videos
            );

        const replace =
            saveOptions.replace ===
            true;

        const images =
            replace
                ? incomingImages
                : mergeUrlLists(
                    previousImages,
                    incomingImages
                );

        const videos =
            replace
                ? incomingVideos
                : mergeUrlLists(
                    previousVideos,
                    incomingVideos
                );

        const now =
            new Date()
                .toISOString();

        const existingMedia =
            (
                product.media &&
                typeof product.media ===
                    'object'
            )
                ? product.media
                : {};

        const source =
            normalizeText(
                mediaInput.source ||
                existingMedia.source
            ) ||
            null;

        const capturedAt =
            normalizeText(
                mediaInput.capturedAt ||
                existingMedia.capturedAt
            ) ||
            (
                incomingImages.length ||
                incomingVideos.length
                    ? now
                    : null
            );

        product.image =
            images[0] ||
            product.image ||
            null;

        product.images =
            images;

        product.video =
            videos[0] ||
            null;

        product.videos =
            videos;

        product.media = {
            ...existingMedia,

            source,

            capturedAt,

            lastCheckedAt:
                normalizeText(
                    mediaInput.lastCheckedAt
                ) ||
                now,

            imageCount:
                images.length,

            videoCount:
                videos.length
        };

        const persisted =
            saveOptions.persist ===
            false
                ? null
                : persist();

        return {
            entry,

            persisted,

            state:
                getMediaState(
                    marketplace,
                    itemId,
                    {
                        minImages:
                            saveOptions.minImages
                    }
                )
        };
    }


    function markChecked(
        marketplace,
        itemId,
        checkOptions = {}
    ) {
        const entry =
            getEntry(
                marketplace,
                itemId
            );

        const product =
            entry.product;

        const existingMedia =
            (
                product.media &&
                typeof product.media ===
                    'object'
            )
                ? product.media
                : {};

        product.media = {
            ...existingMedia,

            lastCheckedAt:
                normalizeText(
                    checkOptions.checkedAt
                ) ||
                new Date()
                    .toISOString()
        };

        const persisted =
            checkOptions.persist ===
            false
                ? null
                : persist();

        return {
            entry,
            persisted,
            state:
                getMediaState(
                    marketplace,
                    itemId
                )
        };
    }


    return {
        getEntry,
        getMediaState,
        hasEnoughMedia,
        needsEnrichment,
        saveMedia,
        markChecked,
        persist
    };
}


module.exports = {
    DEFAULT_MIN_IMAGES,
    normalizeUrl,
    normalizeUrlList,
    mergeUrlLists,
    normalizeMinimumImages,
    createProductMediaLibrary
};

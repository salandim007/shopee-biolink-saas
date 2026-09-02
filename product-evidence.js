'use strict';

const path = require('path');

const {
    getLatestCsvFile,
    readFeed
} = require('./feed-test');

const {
    fetchProductOfferByItemId
} = require('./shopee-product-url');


const COMMERCIAL_SOURCE =
    'Shopee Affiliate Open API';

const FACTUAL_SOURCE =
    'Shopee Data Feed';


function normalizeItemId(value) {
    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const itemId =
        String(value).trim();

    return itemId || null;
}


function valueOrNull(value) {
    return (
        value === undefined ||
        value === null ||
        value === ''
    )
        ? null
        : value;
}


function createFactualEvidence(row) {
    return {
        title:
            valueOrNull(row.title),

        description:
            valueOrNull(row.description),

        globalItemAttributes:
            valueOrNull(
                row.global_item_attributes
            ),

        globalCategory1:
            valueOrNull(
                row.global_category1
            ),

        globalCategory2:
            valueOrNull(
                row.global_category2
            ),

        globalCategory3:
            valueOrNull(
                row.global_category3
            ),

        globalCategoryId1:
            valueOrNull(
                row.global_catid1
            ),

        globalCategoryId2:
            valueOrNull(
                row.global_catid2
            ),

        globalCategoryId3:
            valueOrNull(
                row.global_catid3
            ),

        price:
            valueOrNull(row.price),

        salePrice:
            valueOrNull(row.sale_price)
    };
}


function getFeedFileName(csvFile) {
    return (
        csvFile?.sourcePath ||
        csvFile?.name ||
        csvFile?.fullPath ||
        null
    );
}


function createCsvFileDescriptor(
    csvFilePath
) {
    if (
        typeof csvFilePath !== 'string' ||
        !csvFilePath.trim()
    ) {
        throw new Error(
            'Caminho do CSV inválido.'
        );
    }

    const sourcePath =
        path.normalize(
            csvFilePath.trim()
        );

    return {
        name:
            path.basename(sourcePath),

        fullPath:
            path.resolve(sourcePath),

        sourcePath
    };
}


function createProductEvidenceService(
    options = {}
) {
    const findLatestCsvFile =
        options.getLatestCsvFile ||
        getLatestCsvFile;

    const scanFeed =
        options.readFeed ||
        readFeed;

    const fetchOffer =
        options.fetchProductOfferByItemId ||
        fetchProductOfferByItemId;

    const factualByItemId =
        new Map();


    async function findFactualEvidence(
        itemIds,
        csvFile
    ) {
        const pending =
            new Set(
                itemIds.filter(
                    itemId =>
                        !factualByItemId.has(
                            itemId
                        )
                )
            );

        if (pending.size === 0) {
            return;
        }

        await scanFeed(
            csvFile,
            row => {
                const itemId =
                    normalizeItemId(
                        row?.itemid
                    );

                if (
                    !itemId ||
                    !pending.has(itemId)
                ) {
                    return false;
                }

                factualByItemId.set(
                    itemId,
                    createFactualEvidence(row)
                );

                pending.delete(itemId);

                return pending.size === 0;
            }
        );
    }


    async function fromApiProducts(
        apiProducts,
        requestOptions = {}
    ) {
        if (!Array.isArray(apiProducts)) {
            throw new Error(
                'Informe uma lista de produtos da Affiliate API.'
            );
        }

        const products =
            apiProducts.map(
                apiProduct => {
                    const itemId =
                        normalizeItemId(
                            apiProduct?.itemId
                        );

                    if (!itemId) {
                        throw new Error(
                            'Produto da Affiliate API sem itemId.'
                        );
                    }

                    return {
                        itemId,
                        apiProduct
                    };
                }
            );

        if (products.length === 0) {
            return [];
        }

        const csvFile =
            requestOptions.csvFilePath
                ? createCsvFileDescriptor(
                    requestOptions.csvFilePath
                )
                : requestOptions.csvFile ||
                    findLatestCsvFile();

        await findFactualEvidence(
            [
                ...new Set(
                    products.map(
                        product =>
                            product.itemId
                    )
                )
            ],
            csvFile
        );

        const feedFile =
            getFeedFileName(csvFile);

        return products.map(
            ({ itemId, apiProduct }) => {
                const factual =
                    factualByItemId.get(
                        itemId
                    ) || null;

                return {
                    marketplace:
                        'shopee',

                    itemId,

                    commercial:
                        { ...apiProduct },

                    factual,

                    provenance: {
                        commercialSource:
                            COMMERCIAL_SOURCE,

                        factualSource:
                            factual
                                ? FACTUAL_SOURCE
                                : null,

                        feedFile:
                            factual
                                ? feedFile
                                : null,

                        matchedBy:
                            factual
                                ? 'itemId'
                                : null
                    }
                };
            }
        );
    }


    async function fromItemIds(
        itemIds,
        requestOptions = {}
    ) {
        if (!Array.isArray(itemIds)) {
            throw new Error(
                'Informe uma lista de itemIds.'
            );
        }

        const normalizedItemIds =
            itemIds.map(
                itemId => {
                    const normalized =
                        normalizeItemId(itemId);

                    if (!normalized) {
                        throw new Error(
                            'itemId inválido.'
                        );
                    }

                    return normalized;
                }
            );

        const apiProducts =
            await Promise.all(
                normalizedItemIds.map(
                    async itemId => {
                        const result =
                            await fetchOffer(
                                itemId
                            );

                        return (
                            result?.product ||
                            result
                        );
                    }
                )
            );

        return fromApiProducts(
            apiProducts,
            requestOptions
        );
    }


    return {
        fromApiProducts,
        fromItemIds
    };
}


const defaultProductEvidenceService =
    createProductEvidenceService();


module.exports = {
    COMMERCIAL_SOURCE,
    FACTUAL_SOURCE,
    normalizeItemId,
    createFactualEvidence,
    createCsvFileDescriptor,
    createProductEvidenceService,
    defaultProductEvidenceService
};

'use strict';

const {
    defaultCatalogStore
} = require('./product-catalog-store');

const {
    fetchShopeeProductSnapshot
} = require('./vitrine2-product-sync');


/*
 * ============================================================
 * VITRINE 2 - PRODUCT SYNC SERVICE
 * ============================================================
 *
 * Responsabilidade deste arquivo:
 *
 * - localizar o produto atual no catálogo;
 * - consultar os dados atuais na Shopee;
 * - preservar configurações internas da Vitrine;
 * - atualizar preço, comissão, desempenho e categorias;
 * - permitir prévia sem salvar;
 * - salvar somente quando solicitado.
 *
 * Este arquivo NÃO altera a vitrine2.ejs.
 * ============================================================
 */


function preserveCatalogOptions(entry) {
    return {
        published:
            entry.visibility?.published ??
            false,

        featured:
            entry.visibility?.featured ??
            false,

        position:
            entry.visibility?.position ??
            null,

        collections:
            Array.isArray(
                entry.collections
            )
                ? [...entry.collections]
                : []
    };
}


function mergeShopeeSnapshot(
    currentProduct,
    snapshot
) {
    const current =
        currentProduct || {};

    const currentMetadata =
        current.metadata &&
        typeof current.metadata ===
            'object'
            ? current.metadata
            : {};

    const categoryMetadata =
        snapshot.categoryMetadata &&
        typeof snapshot.categoryMetadata ===
            'object'
            ? snapshot.categoryMetadata
            : {};


    return {
        ...current,

        marketplace:
            'shopee',

        itemId:
            snapshot.itemId ||
            current.itemId,

        shopId:
            snapshot.shopId ??
            current.shopId,

        title:
            snapshot.title ??
            current.title,

        price:
            snapshot.price ??
            current.price,

        minPrice:
            snapshot.minPrice ??
            current.minPrice ??
            snapshot.price ??
            current.price,

        maxPrice:
            snapshot.maxPrice ??
            current.maxPrice ??
            snapshot.price ??
            current.price,

        priceDiscountRate:
            snapshot.priceDiscountRate ??
            current.priceDiscountRate ??
            null,

        image:
            snapshot.image ??
            current.image,

        affiliateLink:
            snapshot.affiliateLink ??
            current.affiliateLink,

        shopName:
            snapshot.shopName ??
            current.shopName,


        // ====================================================
        // COMISSÃO / DESEMPENHO
        // ====================================================

        commissionRate:
            snapshot.commissionRate ??
            current.commissionRate,

        commission:
            snapshot.commission ??
            current.commission ??
            null,

        sellerCommissionRate:
            snapshot.sellerCommissionRate ??
            current.sellerCommissionRate ??
            null,

        shopeeCommissionRate:
            snapshot.shopeeCommissionRate ??
            current.shopeeCommissionRate ??
            null,

        sales:
            snapshot.sales ??
            current.sales ??
            null,

        ratingStar:
            snapshot.ratingStar ??
            current.ratingStar ??
            null,


        // ====================================================
        // CATEGORIAS
        // ====================================================

        category1:
            snapshot.category1 ??
            current.category1 ??
            null,

        category2:
            snapshot.category2 ??
            current.category2 ??
            null,

        category3:
            snapshot.category3 ??
            current.category3 ??
            null,


        // ====================================================
        // METADATA
        // ====================================================

        metadata: {
            ...currentMetadata,

            productLink:
                snapshot.productLink ??
                currentMetadata.productLink ??
                null,

            productCatIds:
                Array.isArray(
                    categoryMetadata.productCatIds
                )
                    ? categoryMetadata.productCatIds
                    : (
                        Array.isArray(
                            currentMetadata.productCatIds
                        )
                            ? currentMetadata.productCatIds
                            : []
                    ),

            categoryId1:
                categoryMetadata.categoryId1 ??
                currentMetadata.categoryId1 ??
                null,

            categoryId2:
                categoryMetadata.categoryId2 ??
                currentMetadata.categoryId2 ??
                null,

            categoryId3:
                categoryMetadata.categoryId3 ??
                currentMetadata.categoryId3 ??
                null,

            sourceCategory1:
                categoryMetadata.sourceCategory1 ??
                currentMetadata.sourceCategory1 ??
                null,

            sourceCategory2:
                categoryMetadata.sourceCategory2 ??
                currentMetadata.sourceCategory2 ??
                null,

            sourceCategory3:
                categoryMetadata.sourceCategory3 ??
                currentMetadata.sourceCategory3 ??
                null,

            categorySourceFile:
                categoryMetadata.sourceFile ??
                currentMetadata.categorySourceFile ??
                null,

            lastSyncedAt:
                snapshot.syncedAt,

            syncSource:
                'shopee_affiliate_api'
        }
    };
}


async function prepareProductSync(
    itemId,
    options = {}
) {
    const catalogStore =
        options.catalogStore ||
        defaultCatalogStore;

    const catalog =
        catalogStore.load();

    const entry =
        catalog.getProduct(
            'shopee',
            itemId
        );

    if (!entry) {
        throw new Error(
            `Produto Shopee ${itemId} não encontrado no catálogo.`
        );
    }

    const snapshot =
        await fetchShopeeProductSnapshot(
            itemId
        );

    const catalogOptions =
        preserveCatalogOptions(
            entry
        );

    const updatedProduct =
        mergeShopeeSnapshot(
            entry.product,
            snapshot
        );

    return {
        catalogStore,
        catalog,

        currentEntry:
            entry,

        snapshot,

        catalogOptions,

        updatedProduct
    };
}


async function previewProductSync(
    itemId,
    options = {}
) {
    const prepared =
        await prepareProductSync(
            itemId,
            options
        );

    return {
        itemId:
            String(itemId),

        before: {
            title:
                prepared.currentEntry
                    .product?.title ??
                null,

            price:
                prepared.currentEntry
                    .product?.price ??
                null,

            commissionRate:
                prepared.currentEntry
                    .product?.commissionRate ??
                null,

            commission:
                prepared.currentEntry
                    .product?.commission ??
                null,

            sales:
                prepared.currentEntry
                    .product?.sales ??
                null,

            ratingStar:
                prepared.currentEntry
                    .product?.ratingStar ??
                null,

            category1:
                prepared.currentEntry
                    .product?.category1 ??
                null,

            category2:
                prepared.currentEntry
                    .product?.category2 ??
                null,

            category3:
                prepared.currentEntry
                    .product?.category3 ??
                null
        },

        after: {
            title:
                prepared.updatedProduct
                    .title ??
                null,

            price:
                prepared.updatedProduct
                    .price ??
                null,

            commissionRate:
                prepared.updatedProduct
                    .commissionRate ??
                null,

            commission:
                prepared.updatedProduct
                    .commission ??
                null,

            sellerCommissionRate:
                prepared.updatedProduct
                    .sellerCommissionRate ??
                null,

            shopeeCommissionRate:
                prepared.updatedProduct
                    .shopeeCommissionRate ??
                null,

            sales:
                prepared.updatedProduct
                    .sales ??
                null,

            ratingStar:
                prepared.updatedProduct
                    .ratingStar ??
                null,

            priceDiscountRate:
                prepared.updatedProduct
                    .priceDiscountRate ??
                null,

            category1:
                prepared.updatedProduct
                    .category1 ??
                null,

            category2:
                prepared.updatedProduct
                    .category2 ??
                null,

            category3:
                prepared.updatedProduct
                    .category3 ??
                null,

            lastSyncedAt:
                prepared.updatedProduct
                    .metadata
                    ?.lastSyncedAt ??
                null
        },

        preserved: {
            published:
                prepared.catalogOptions
                    .published,

            featured:
                prepared.catalogOptions
                    .featured,

            position:
                prepared.catalogOptions
                    .position,

            collections:
                prepared.catalogOptions
                    .collections
        }
    };
}


async function syncProduct(
    itemId,
    options = {}
) {
    const prepared =
        await prepareProductSync(
            itemId,
            options
        );

    const entry =
        prepared.catalog.addProduct(
            prepared.updatedProduct,
            prepared.catalogOptions
        );

    prepared.catalogStore.save(
        prepared.catalog
    );

    return entry;
}


/*
 * ============================================================
 * TESTE PELO TERMINAL
 * ============================================================
 *
 * Prévia segura:
 *
 * node vitrine2-product-sync-service.js 22193593141
 *
 * Sincronização real:
 *
 * node vitrine2-product-sync-service.js 22193593141 --save
 * ============================================================
 */

async function main() {
    const itemId =
        process.argv[2];

    const shouldSave =
        process.argv.includes(
            '--save'
        );

    if (!itemId) {
        console.log('');

        console.log(
            'Uso:'
        );

        console.log(
            'node vitrine2-product-sync-service.js ITEM_ID'
        );

        console.log('');

        console.log(
            'Para salvar:'
        );

        console.log(
            'node vitrine2-product-sync-service.js ITEM_ID --save'
        );

        console.log('');

        process.exitCode = 1;

        return;
    }


    console.log('');

    console.log(
        '========================================'
    );

    console.log(
        'VITRINE 2 - PRODUCT SYNC SERVICE'
    );

    console.log(
        '========================================'
    );

    console.log('');


    if (!shouldSave) {
        console.log(
            'MODO: PRÉVIA - NENHUM DADO SERÁ SALVO'
        );

        console.log('');


        const preview =
            await previewProductSync(
                itemId
            );


        console.log(
            JSON.stringify(
                preview,
                null,
                2
            )
        );


        console.log('');

        console.log(
            'Prévia concluída.'
        );

        console.log(
            'Nenhum dado do catálogo foi alterado.'
        );

        console.log('');

        return;
    }


    console.log(
        'MODO: SINCRONIZAÇÃO REAL'
    );

    console.log('');


    const entry =
        await syncProduct(
            itemId
        );


    console.log(
        JSON.stringify(
            {
                itemId:
                    entry.product
                        ?.itemId,

                title:
                    entry.product
                        ?.title,

                price:
                    entry.product
                        ?.price,

                commissionRate:
                    entry.product
                        ?.commissionRate,

                commission:
                    entry.product
                        ?.commission,

                sellerCommissionRate:
                    entry.product
                        ?.sellerCommissionRate,

                shopeeCommissionRate:
                    entry.product
                        ?.shopeeCommissionRate,

                sales:
                    entry.product
                        ?.sales,

                ratingStar:
                    entry.product
                        ?.ratingStar,

                priceDiscountRate:
                    entry.product
                        ?.priceDiscountRate,

                category1:
                    entry.product
                        ?.category1,

                category2:
                    entry.product
                        ?.category2,

                category3:
                    entry.product
                        ?.category3,

                visibility:
                    entry.visibility,

                collections:
                    entry.collections,

                lastSyncedAt:
                    entry.product
                        ?.metadata
                        ?.lastSyncedAt
            },
            null,
            2
        )
    );


    console.log('');

    console.log(
        'Produto sincronizado e catálogo salvo.'
    );

    console.log('');
}


if (
    require.main ===
    module
) {
    main()
        .catch(
            error => {
                console.error('');

                console.error(
                    '[VITRINE2 SYNC SERVICE] ERRO:'
                );

                console.error(
                    error.message
                );

                console.error('');

                process.exitCode = 1;
            }
        );
}


module.exports = {
    preserveCatalogOptions,
    mergeShopeeSnapshot,
    prepareProductSync,
    previewProductSync,
    syncProduct
};
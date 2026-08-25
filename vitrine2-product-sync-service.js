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
 * - montar a versão atualizada do produto;
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
            Array.isArray(entry.collections)
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

    return {
        ...current,

        marketplace:
            'shopee',

        itemId:
            snapshot.itemId ||
            current.itemId,

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

        image:
            snapshot.image ??
            current.image,

        affiliateLink:
            snapshot.affiliateLink ??
            current.affiliateLink,

        shopName:
            snapshot.shopName ??
            current.shopName,

        commissionRate:
            snapshot.commissionRate ??
            current.commissionRate,

        metadata: {
            ...(
                current.metadata &&
                typeof current.metadata === 'object'
                    ? current.metadata
                    : {}
            ),

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

            affiliateLink:
                prepared.currentEntry
                    .product?.affiliateLink ??
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

            affiliateLink:
                prepared.updatedProduct
                    .affiliateLink ??
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
 * node vitrine2-product-sync-service.js 18599566917
 *
 * Sincronização real:
 *
 * node vitrine2-product-sync-service.js 18599566917 --save
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
                    entry.product?.itemId,

                title:
                    entry.product?.title,

                price:
                    entry.product?.price,

                affiliateLink:
                    entry.product
                        ?.affiliateLink,

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


if (require.main === module) {
    main().catch(
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

'use strict';

const {
    defaultVitrine2Service
} = require('./vitrine2-service');

const {
    syncProduct
} = require('./vitrine2-product-sync-service');


/*
 * ============================================================
 * VITRINE 2 - PRODUCT SYNC BATCH
 * ============================================================
 *
 * Responsabilidade deste arquivo:
 *
 * - listar produtos publicados da Vitrine 2;
 * - sincronizar um produto por vez;
 * - continuar mesmo quando um item falhar;
 * - mostrar resultado individual;
 * - mostrar resumo final.
 *
 * Este arquivo NÃO altera a vitrine2.ejs.
 * ============================================================
 */


function getEntryItemId(entry) {
    return (
        entry?.product?.itemId ??
        entry?.itemId ??
        null
    );
}


function getEntryTitle(entry) {
    return (
        entry?.product?.title ??
        entry?.title ??
        'Produto sem título'
    );
}


async function syncPublishedProducts(
    options = {}
) {
    const service =
        options.service ||
        defaultVitrine2Service;

    const syncOne =
        options.syncOne ||
        syncProduct;

    const publishedEntries =
        service.listPublished();

    const total =
        publishedEntries.length;

    const summary = {
        total,
        success: 0,
        failed: 0,
        results: []
    };

    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        'VITRINE 2 - SINCRONIZAÇÃO EM LOTE'
    );
    console.log(
        '========================================'
    );
    console.log('');
    console.log(
        `Produtos publicados encontrados: ${total}`
    );
    console.log('');

    if (total === 0) {
        console.log(
            'Nenhum produto publicado para sincronizar.'
        );
        console.log('');

        return summary;
    }

    for (
        let index = 0;
        index < publishedEntries.length;
        index += 1
    ) {
        const entry =
            publishedEntries[index];

        const itemId =
            getEntryItemId(
                entry
            );

        const title =
            getEntryTitle(
                entry
            );

        const number =
            index + 1;

        console.log(
            `[${number}/${total}] ${title}`
        );

        if (!itemId) {
            const errorMessage =
                'Produto sem itemId.';

            console.log(
                `ERRO: ${errorMessage}`
            );
            console.log('');

            summary.failed += 1;

            summary.results.push({
                itemId: null,
                title,
                success: false,
                error: errorMessage
            });

            continue;
        }

        try {
            const updatedEntry =
                await syncOne(
                    itemId
                );

            const updatedPrice =
                updatedEntry
                    ?.product
                    ?.price ??
                null;

            const lastSyncedAt =
                updatedEntry
                    ?.product
                    ?.metadata
                    ?.lastSyncedAt ??
                null;

            console.log(
                `OK - itemId ${itemId}`
            );

            if (
                updatedPrice !== null &&
                updatedPrice !== undefined
            ) {
                console.log(
                    `Preço atual: R$ ${Number(updatedPrice).toFixed(2)}`
                );
            }

            summary.success += 1;

            summary.results.push({
                itemId:
                    String(itemId),
                title,
                success: true,
                price:
                    updatedPrice,
                lastSyncedAt
            });
        } catch (error) {
            const errorMessage =
                error?.message ||
                String(error);

            console.log(
                `ERRO - itemId ${itemId}`
            );
            console.log(
                errorMessage
            );

            summary.failed += 1;

            summary.results.push({
                itemId:
                    String(itemId),
                title,
                success: false,
                error:
                    errorMessage
            });
        }

        console.log('');
    }

    console.log(
        '========================================'
    );
    console.log(
        'RESUMO DA SINCRONIZAÇÃO'
    );
    console.log(
        '========================================'
    );
    console.log(
        `Total: ${summary.total}`
    );
    console.log(
        `Sucesso: ${summary.success}`
    );
    console.log(
        `Falhas: ${summary.failed}`
    );
    console.log('');

    return summary;
}


async function main() {
    await syncPublishedProducts();
}


if (require.main === module) {
    main().catch(
        error => {
            console.error('');
            console.error(
                '[VITRINE2 SYNC BATCH] ERRO FATAL:'
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
    getEntryItemId,
    getEntryTitle,
    syncPublishedProducts
};

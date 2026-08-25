'use strict';

const {
    fetchProductOfferByItemId
} = require('./shopee-product-url');


/*
 * ============================================================
 * VITRINE 2 - PRODUCT SYNC
 * ============================================================
 *
 * Responsabilidade deste arquivo:
 *
 * - consultar um produto atual na Shopee pelo itemId;
 * - transformar a resposta em um snapshot simples;
 * - NÃO alterar o catálogo;
 * - NÃO alterar a Vitrine;
 * - NÃO salvar dados.
 *
 * A persistência será conectada em uma etapa posterior.
 * ============================================================
 */


/**
 * Tenta localizar o produto dentro da resposta retornada por
 * fetchProductOfferByItemId().
 *
 * Mantemos esta função isolada para que mudanças no formato
 * interno da resposta da API não se espalhem pelo projeto.
 */
function extractApiProduct(result) {
    if (!result) {
        return null;
    }

    if (result.product) {
        return result.product;
    }

    if (result.apiProduct) {
        return result.apiProduct;
    }

    if (result.node) {
        return result.node;
    }

    if (
        Array.isArray(result.products) &&
        result.products.length
    ) {
        return result.products[0];
    }

    if (
        result.itemId ||
        result.productName
    ) {
        return result;
    }

    return null;
}


/**
 * Converte um valor para número quando possível.
 */
function toNullableNumber(value) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return null;
    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


/**
 * Cria um snapshot atualizado do produto na Shopee.
 *
 * Esse snapshot ainda NÃO é salvo automaticamente.
 */
async function fetchShopeeProductSnapshot(
    itemId
) {
    const normalizedItemId =
        String(
            itemId || ''
        ).trim();

    if (!normalizedItemId) {
        throw new Error(
            'itemId não informado para sincronização.'
        );
    }

    const result =
        await fetchProductOfferByItemId(
            normalizedItemId
        );

    const apiProduct =
        extractApiProduct(
            result
        );

    if (!apiProduct) {
        throw new Error(
            `A Shopee não retornou dados válidos para o itemId ${normalizedItemId}.`
        );
    }

    const price =
        toNullableNumber(
            apiProduct.price
        );

    return {
        marketplace:
            'shopee',

        itemId:
            String(
                apiProduct.itemId ||
                normalizedItemId
            ),

        title:
            apiProduct.productName ??
            null,

        price,

        minPrice:
            price,

        maxPrice:
            price,

        image:
            apiProduct.imageUrl ??
            null,

        affiliateLink:
            apiProduct.offerLink ??
            null,

        shopName:
            apiProduct.shopName ??
            null,

        commissionRate:
            toNullableNumber(
                apiProduct.commissionRate
            ),

        syncedAt:
            new Date().toISOString()
    };
}


/*
 * ============================================================
 * TESTE DIRETO PELO TERMINAL
 * ============================================================
 *
 * Exemplo:
 *
 * node vitrine2-product-sync.js 18599566917
 *
 * Apenas consulta e imprime.
 * Não modifica nenhum dado do projeto.
 * ============================================================
 */

async function main() {
    const itemId =
        process.argv[2];

    if (!itemId) {
        console.log('');
        console.log(
            'Uso:'
        );
        console.log(
            'node vitrine2-product-sync.js ITEM_ID'
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
        'VITRINE 2 - TESTE DE PRODUCT SYNC'
    );
    console.log(
        '========================================'
    );
    console.log('');
    console.log(
        `Consultando itemId: ${itemId}`
    );
    console.log('');

    const snapshot =
        await fetchShopeeProductSnapshot(
            itemId
        );

    console.log(
        JSON.stringify(
            snapshot,
            null,
            2
        )
    );

    console.log('');
    console.log(
        'Consulta concluída.'
    );
    console.log(
        'Nenhum dado do catálogo foi alterado.'
    );
    console.log('');
}


if (require.main === module) {
    main().catch(
        error => {
            console.error('');
            console.error(
                '[VITRINE2 SYNC] ERRO:'
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
    extractApiProduct,
    fetchShopeeProductSnapshot
};

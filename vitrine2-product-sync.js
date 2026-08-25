'use strict';

const {
    fetchProductOfferByItemId
} = require('./shopee-product-url');

const {
    resolveCategoryIds
} = require('./category-id-resolver');


/*
 * ============================================================
 * VITRINE 2 - PRODUCT SYNC
 * ============================================================
 *
 * Responsabilidade deste arquivo:
 *
 * - consultar um produto atual na Shopee pelo itemId;
 * - transformar a resposta em um snapshot simples;
 * - resolver as categorias oficiais da Shopee;
 * - entregar category1/category2/category3 em pt-BR;
 * - NÃO alterar o catálogo;
 * - NÃO alterar a Vitrine;
 * - NÃO salvar dados.
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
 * Cria estrutura vazia de categorias.
 */
function createEmptyCategories() {
    return {
        category1: null,
        category2: null,
        category3: null,

        sourceCategory1: null,
        sourceCategory2: null,
        sourceCategory3: null,

        categoryId1: null,
        categoryId2: null,
        categoryId3: null,

        sourceFile: null
    };
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


    // ========================================================
    // CONSULTA SHOPEE
    // ========================================================

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


    // ========================================================
    // PREÇOS
    // ========================================================

    const price =
        toNullableNumber(
            apiProduct.price
        );


    const minPrice =
        toNullableNumber(
            apiProduct.priceMin
        ) ??
        price;


    const maxPrice =
        toNullableNumber(
            apiProduct.priceMax
        ) ??
        price;


    // ========================================================
    // CATEGORIAS
    // ========================================================

    const productCatIds =
        Array.isArray(
            apiProduct.productCatIds
        )
            ? apiProduct.productCatIds
            : [];


    let categories =
        createEmptyCategories();


    if (
        productCatIds.length >
        0
    ) {
        categories =
            await resolveCategoryIds(
                productCatIds
            );
    }


    // ========================================================
    // SNAPSHOT
    // ========================================================

    return {
        marketplace:
            'shopee',

        itemId:
            String(
                apiProduct.itemId ||
                normalizedItemId
            ),

        shopId:
            apiProduct.shopId !==
            null &&
            apiProduct.shopId !==
            undefined
                ? String(
                    apiProduct.shopId
                )
                : null,

        title:
            apiProduct.productName ??
            null,

        price,

        minPrice,

        maxPrice,

        image:
            apiProduct.imageUrl ??
            null,

        affiliateLink:
            apiProduct.offerLink ??
            null,

        productLink:
            apiProduct.productLink ??
            null,

        shopName:
            apiProduct.shopName ??
            null,

        commissionRate:
            toNullableNumber(
                apiProduct.commissionRate
            ),

        category1:
            categories.category1,

        category2:
            categories.category2,

        category3:
            categories.category3,

        categoryMetadata: {
            productCatIds,

            categoryId1:
                categories.categoryId1,

            categoryId2:
                categories.categoryId2,

            categoryId3:
                categories.categoryId3,

            sourceCategory1:
                categories.sourceCategory1,

            sourceCategory2:
                categories.sourceCategory2,

            sourceCategory3:
                categories.sourceCategory3,

            sourceFile:
                categories.sourceFile
        },

        syncedAt:
            new Date()
                .toISOString()
    };
}


/*
 * ============================================================
 * TESTE DIRETO PELO TERMINAL
 * ============================================================
 *
 * Exemplo:
 *
 * node vitrine2-product-sync.js 43173265179
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


if (
    require.main ===
    module
) {
    main()
        .catch(
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
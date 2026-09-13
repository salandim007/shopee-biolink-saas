const crypto = require('crypto');

const SHOPEE_API_ENDPOINT =
    'https://open-api.affiliate.shopee.com.br/graphql';


function getCredentials() {
    const appId =
        process.env.SHOPEE_AFFILIATE_APP_ID;

    const secret =
        process.env.SHOPEE_AFFILIATE_SECRET;

    if (!appId || !secret) {
        throw new Error(
            'Credenciais da Shopee não encontradas.'
        );
    }

    return {
        appId,
        secret
    };
}


function createAuthorization(payload) {
    const {
        appId,
        secret
    } =
        getCredentials();

    const timestamp =
        Math.floor(
            Date.now() / 1000
        ).toString();

    const signature =
        crypto
            .createHash('sha256')
            .update(
                appId +
                timestamp +
                payload +
                secret
            )
            .digest('hex');

    return [
        'SHA256',
        `Credential=${appId},`,
        `Timestamp=${timestamp},`,
        `Signature=${signature}`
    ].join(' ');
}


async function requestProducts({
    keyword = null,
    productCatId = null,
    listType = null,
    page = 1,
    limit = 50
} = {}) {
    const variableDefinitions = [
        '$page: Int',
        '$limit: Int'
    ];

    const argumentsList = [
        'page: $page',
        'limit: $limit'
    ];

    const variables = {
        page:
            Number(page) || 1,

        limit:
            Number(limit) || 50
    };


    if (
        keyword !== null &&
        keyword !== undefined &&
        String(keyword).trim() !== ''
    ) {
        variableDefinitions.push(
            '$keyword: String'
        );

        argumentsList.push(
            'keyword: $keyword'
        );

        variables.keyword =
            String(keyword).trim();
    }


    if (
        productCatId !== null &&
        productCatId !== undefined &&
        productCatId !== ''
    ) {
        variableDefinitions.push(
            '$productCatId: Int'
        );

        argumentsList.push(
            'productCatId: $productCatId'
        );

        variables.productCatId =
            Number(productCatId);
    }


    if (
        listType !== null &&
        listType !== undefined &&
        listType !== ''
    ) {
        variableDefinitions.push(
            '$listType: Int'
        );

        argumentsList.push(
            'listType: $listType'
        );

        variables.listType =
            Number(listType);
    }


    const query = `
        query SearchOpportunities(
            ${variableDefinitions.join('\n')}
        ) {
            productOfferV2(
                ${argumentsList.join('\n')}
            ) {
                nodes {
                    itemId
                    shopId
                    productName

                    price
                    priceMin
                    priceMax
                    priceDiscountRate

                    commissionRate
                    commission
                    sellerCommissionRate
                    shopeeCommissionRate

                    sales
                    ratingStar

                    imageUrl
                    offerLink
                    productLink
                    shopName
                    productCatIds
                }

                pageInfo {
                    scrollId
                    hasNextPage
                }
            }
        }
    `;

    const body = {
        query,
        variables
    };

    const payload =
        JSON.stringify(
            body
        );

    const authorization =
        createAuthorization(
            payload
        );

    const response =
        await fetch(
            SHOPEE_API_ENDPOINT,
            {
                method:
                    'POST',

                headers: {
                    'Content-Type':
                        'application/json',

                    Authorization:
                        authorization
                },

                body:
                    payload
            }
        );

    const text =
        await response.text();

    if (!response.ok) {
        throw new Error(
            `Shopee API HTTP ${response.status}: ${text}`
        );
    }

    const json =
        JSON.parse(
            text
        );

    if (
        Array.isArray(
            json.errors
        ) &&
        json.errors.length > 0
    ) {
        throw new Error(
            json.errors
                .map(
                    error =>
                        error.message
                )
                .join(' | ')
        );
    }

    const result =
        json?.data
            ?.productOfferV2;

    return {
        products:
            Array.isArray(
                result?.nodes
            )
                ? result.nodes
                : [],

        pageInfo:
            result?.pageInfo ||
            null
    };
}


function normalizeNumber(value) {
    const number =
        Number(value);

    return Number.isFinite(
        number
    )
        ? number
        : 0;
}


function rankProducts(products) {
    return [
        ...products
    ].sort(
        (
            a,
            b
        ) => {
            const salesDifference =
                normalizeNumber(
                    b.sales
                ) -
                normalizeNumber(
                    a.sales
                );

            if (
                salesDifference !== 0
            ) {
                return salesDifference;
            }

            const ratingDifference =
                normalizeNumber(
                    b.ratingStar
                ) -
                normalizeNumber(
                    a.ratingStar
                );

            if (
                ratingDifference !== 0
            ) {
                return ratingDifference;
            }

            const discountDifference =
                normalizeNumber(
                    b.priceDiscountRate
                ) -
                normalizeNumber(
                    a.priceDiscountRate
                );

            if (
                discountDifference !== 0
            ) {
                return discountDifference;
            }

            return (
                normalizeNumber(
                    b.commission
                ) -
                normalizeNumber(
                    a.commission
                )
            );
        }
    );
}


async function searchOpportunities({
    keyword = null,
    productCatId = null,
    listType = null,
    pages = 3,
    limitPerPage = 50,
    minimumSales = 1,
    top = 30
} = {}) {
    const hasListType =
        listType !== null &&
        listType !== undefined &&
        listType !== '';

    if (
        !keyword &&
        !productCatId &&
        !hasListType
    ) {
        throw new Error(
            'Informe keyword, productCatId ou listType.'
        );
    }

    const collected =
        new Map();

    const totalPages =
        Math.max(
            1,
            Number(pages) || 1
        );

    for (
        let page = 1;
        page <= totalPages;
        page += 1
    ) {
        const result =
            await requestProducts({
                keyword,
                productCatId,
                listType,
                page,
                limit:
                    limitPerPage
            });

        for (
            const product
            of result.products
        ) {
            const itemId =
                String(
                    product.itemId
                );

            if (
                !collected.has(
                    itemId
                )
            ) {
                collected.set(
                    itemId,
                    product
                );
            }
        }

        if (
            result.pageInfo &&
            result.pageInfo.hasNextPage === false
        ) {
            break;
        }
    }

    const filtered =
        Array
            .from(
                collected.values()
            )
            .filter(
                product =>
                    normalizeNumber(
                        product.sales
                    ) >=
                    normalizeNumber(
                        minimumSales
                    )
            );

    const ranked =
        rankProducts(
            filtered
        );

    return {
        searchedBy: {
            keyword,
            productCatId,
            listType
        },

        scanned:
            collected.size,

        qualified:
            ranked.length,

        products:
            ranked.slice(
                0,
                Math.max(
                    1,
                    Number(top) || 30
                )
            )
    };
}


module.exports = {
    requestProducts,
    rankProducts,
    searchOpportunities
};

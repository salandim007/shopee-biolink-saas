'use strict';

const shopeeCategoryProvider =
    require('./shopee/category-provider');

const shopeeOpportunityProvider =
    require('./shopee/opportunity-provider');


const MARKETPLACES =
    new Map([
        [
            'shopee',
            {
                id:
                    'shopee',

                name:
                    'Shopee',

                categoryProvider:
                    shopeeCategoryProvider,

                opportunityProvider:
                    shopeeOpportunityProvider
            }
        ]
    ]);


function normalizeMarketplaceId(
    value
) {
    return String(
        value || ''
    )
        .trim()
        .toLowerCase();
}


function listMarketplaces() {
    return Array
        .from(
            MARKETPLACES.values()
        )
        .map(
            marketplace => ({
                id:
                    marketplace.id,

                name:
                    marketplace.name
            })
        );
}


function getMarketplace(
    marketplaceId
) {
    const id =
        normalizeMarketplaceId(
            marketplaceId
        );

    const marketplace =
        MARKETPLACES.get(
            id
        );

    if (!marketplace) {
        throw new Error(
            `Marketplace não suportado: ${marketplaceId}`
        );
    }

    return marketplace;
}


function listCategories({
    marketplace
}) {
    const provider =
        getMarketplace(
            marketplace
        );

    return provider
        .categoryProvider
        .listCategories();
}


function searchCategories({
    marketplace,
    term
}) {
    const provider =
        getMarketplace(
            marketplace
        );

    return provider
        .categoryProvider
        .searchCategories(
            term
        );
}


function findCategoryById({
    marketplace,
    categoryId
}) {
    const provider =
        getMarketplace(
            marketplace
        );

    return provider
        .categoryProvider
        .findCategoryById(
            categoryId
        );
}


async function searchOpportunities({
    marketplace,
    categoryId = null,
    keyword = null,
    listType = null,
    pages = 3,
    limitPerPage = 50,
    minimumSales = 1,
    top = 30
}) {
    const provider =
        getMarketplace(
            marketplace
        );

    if (
        !provider
            .opportunityProvider
            ?.search
    ) {
        throw new Error(
            `Marketplace ${marketplace} não possui busca de oportunidades.`
        );
    }

    return provider
        .opportunityProvider
        .search({
            categoryId,
            keyword,
            listType,
            pages,
            limitPerPage,
            minimumSales,
            top
        });
}


module.exports = {
    listMarketplaces,
    getMarketplace,

    listCategories,
    searchCategories,
    findCategoryById,

    searchOpportunities
};

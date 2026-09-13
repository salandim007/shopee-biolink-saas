'use strict';

const {
    searchOpportunities
} = require('../../shopee-opportunity-search');


const MARKETPLACE =
    'shopee';


async function search({
    categoryId = null,
    keyword = null,
    listType = null,
    pages = 3,
    limitPerPage = 50,
    minimumSales = 1,
    top = 30
} = {}) {

    const result =
        await searchOpportunities({
            productCatId:
                categoryId,

            keyword,

            listType,

            pages,

            limitPerPage,

            minimumSales,

            top
        });

    return {
        marketplace:
            MARKETPLACE,

        ...result
    };
}


module.exports = {
    marketplace:
        MARKETPLACE,

    search
};

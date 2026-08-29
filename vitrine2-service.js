const {
    defaultProductSource
} = require('./product-source');

const {
    defaultCatalogStore
} = require('./product-catalog-store');

const {
    validateInstagramProduct,
    summarizeInstagramDecision
} = require('./instagram-policy-validator');


function createVitrine2Service(
    options = {}
) {
    const productSource =
        options.productSource ||
        defaultProductSource;

    const catalogStore =
        options.catalogStore ||
        defaultCatalogStore;


    function loadCatalog() {
        return catalogStore.load();
    }


    function saveCatalog(catalog) {
        return catalogStore.save(
            catalog
        );
    }


    async function importFromApi(
        url,
        catalogOptions = {}
    ) {
        const catalog =
            loadCatalog();

        const product =
            await productSource.getProduct({
                source: 'api',
                input: url
            });

        const entry =
            catalog.addProduct(
                product,
                catalogOptions
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    async function importFromCsvRow(
        row,
        catalogOptions = {}
    ) {
        const catalog =
            loadCatalog();

        const product =
            await productSource.getProduct({
                source: 'csv',
                row
            });

        const entry =
            catalog.addProduct(
                product,
                catalogOptions
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    function setPublished(
        marketplace,
        itemId,
        published
    ) {
        const catalog =
            loadCatalog();

        const entry =
            catalog.setPublished(
                marketplace,
                itemId,
                published
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    function setFeatured(
        marketplace,
        itemId,
        featured
    ) {
        const catalog =
            loadCatalog();

        const entry =
            catalog.setFeatured(
                marketplace,
                itemId,
                featured
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    function setPosition(
        marketplace,
        itemId,
        position
    ) {
        const catalog =
            loadCatalog();

        const entry =
            catalog.setPosition(
                marketplace,
                itemId,
                position
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    function setMarketingSelected(
        marketplace,
        itemId,
        selected
    ) {
        const catalog =
            loadCatalog();

        const entry =
            catalog.setMarketingSelected(
                marketplace,
                itemId,
                selected
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    function setMarketingStatus(
        marketplace,
        itemId,
        status
    ) {
        const catalog =
            loadCatalog();

        const entry =
            catalog.setMarketingStatus(
                marketplace,
                itemId,
                status
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    function setMarketingChannel(
        marketplace,
        itemId,
        channel,
        enabled
    ) {
        const catalog =
            loadCatalog();

        const entry =
            catalog.setMarketingChannel(
                marketplace,
                itemId,
                channel,
                enabled
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    /*
     * ========================================================
     * INSTAGRAM POLICY ENGINE
     * ========================================================
     */

    function validateInstagramPolicy(
        marketplace,
        itemId
    ) {
        const catalog =
            loadCatalog();

        const entry =
            catalog.getProduct(
                marketplace,
                itemId
            );

        if (!entry) {
            throw new Error(
                'Produto não encontrado no catálogo.'
            );
        }

        if (!entry.product) {
            throw new Error(
                'Produto sem dados disponíveis para validação.'
            );
        }

        const decision =
            validateInstagramProduct(
                entry.product
            );

        const summary =
            summarizeInstagramDecision(
                decision
            );

        return {
            marketplace:
                entry.product.marketplace ||
                marketplace,

            itemId:
                String(
                    entry.product.itemId ||
                    itemId
                ),

            decision,
            summary
        };
    }


    /*
     * Todos os produtos publicados tornam-se candidatos
     * automáticos ao Instagram.
     *
     * A seleção manual do canal não é usada aqui.
     * Cada candidato já retorna com sua decisão de política.
     */
    function listInstagramMarketingCandidates() {
        const catalog =
            loadCatalog();

        const entries =
            catalog.listPublished();

        return entries.map(
            entry => {
                const product =
                    entry?.product || {};

                const decision =
                    validateInstagramProduct(
                        product
                    );

                const summary =
                    summarizeInstagramDecision(
                        decision
                    );

                return {
                    ...entry,

                    policy: {
                        channel: 'instagram',
                        decision,
                        summary
                    }
                };
            }
        );
    }


    function addToCollection(
        marketplace,
        itemId,
        collection
    ) {
        const catalog =
            loadCatalog();

        const entry =
            catalog.addToCollection(
                marketplace,
                itemId,
                collection
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    function removeFromCollection(
        marketplace,
        itemId,
        collection
    ) {
        const catalog =
            loadCatalog();

        const entry =
            catalog.removeFromCollection(
                marketplace,
                itemId,
                collection
            );

        saveCatalog(
            catalog
        );

        return entry;
    }


    function removeProduct(
        marketplace,
        itemId
    ) {
        const catalog =
            loadCatalog();

        const removed =
            catalog.removeProduct(
                marketplace,
                itemId
            );

        saveCatalog(
            catalog
        );

        return removed;
    }


    function getProduct(
        marketplace,
        itemId
    ) {
        const catalog =
            loadCatalog();

        return catalog.getProduct(
            marketplace,
            itemId
        );
    }


    function listAll() {
        const catalog =
            loadCatalog();

        return catalog.listAll();
    }


    function listPublished() {
        const catalog =
            loadCatalog();

        return catalog.listPublished();
    }


    function listFeatured() {
        const catalog =
            loadCatalog();

        return catalog.listFeatured();
    }


    function listByCollection(
        collection
    ) {
        const catalog =
            loadCatalog();

        return catalog.listByCollection(
            collection
        );
    }


    function listMarketingSelected() {
        const catalog =
            loadCatalog();

        return catalog.listMarketingSelected();
    }


    function listMarketingByChannel(
        channel
    ) {
        const catalog =
            loadCatalog();

        return catalog.listMarketingByChannel(
            channel
        );
    }


    return {
        importFromApi,
        importFromCsvRow,
        setPublished,
        setFeatured,
        setPosition,
        setMarketingSelected,
        setMarketingStatus,
        setMarketingChannel,
        validateInstagramPolicy,
        listInstagramMarketingCandidates,
        addToCollection,
        removeFromCollection,
        removeProduct,
        getProduct,
        listAll,
        listPublished,
        listFeatured,
        listByCollection,
        listMarketingSelected,
        listMarketingByChannel
    };
}


const defaultVitrine2Service =
    createVitrine2Service();


module.exports = {
    createVitrine2Service,
    defaultVitrine2Service
};

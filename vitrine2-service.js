const {
    defaultProductSource
} = require('./product-source');

const {
    defaultCatalogStore
} = require('./product-catalog-store');


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


    return {
        importFromApi,
        importFromCsvRow,
        setPublished,
        setFeatured,
        setPosition,
        setMarketingSelected,
        setMarketingStatus,
        addToCollection,
        removeFromCollection,
        removeProduct,
        getProduct,
        listAll,
        listPublished,
        listFeatured,
        listByCollection,
        listMarketingSelected
    };
}


const defaultVitrine2Service =
    createVitrine2Service();


module.exports = {
    createVitrine2Service,
    defaultVitrine2Service
};

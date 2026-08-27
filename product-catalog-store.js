const fs = require('fs');
const path = require('path');

const {
    createProductCatalog
} = require('./product-catalog');


const DEFAULT_STORE_FILE =
    path.join(
        __dirname,
        'data',
        'vitrine2-catalog.json'
    );


function ensureDirectory(filePath) {
    const directory =
        path.dirname(
            filePath
        );

    if (
        !fs.existsSync(
            directory
        )
    ) {
        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        );
    }
}


function serializeCatalog(catalog) {
    if (
        !catalog ||
        typeof catalog.listAll !==
            'function'
    ) {
        throw new Error(
            'Catálogo inválido para persistência.'
        );
    }

    return {
        version: 1,

        savedAt:
            new Date()
                .toISOString(),

        entries:
            catalog.listAll()
    };
}


function writeCatalogFile(
    catalog,
    filePath =
        DEFAULT_STORE_FILE
) {
    ensureDirectory(
        filePath
    );

    const payload =
        serializeCatalog(
            catalog
        );

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            payload,
            null,
            2
        ),
        'utf8'
    );

    return {
        filePath,

        savedAt:
            payload.savedAt,

        entries:
            payload.entries.length
    };
}


function readCatalogFile(
    filePath =
        DEFAULT_STORE_FILE
) {
    if (
        !fs.existsSync(
            filePath
        )
    ) {
        return {
            version: 1,
            savedAt: null,
            entries: []
        };
    }

    const raw =
        fs.readFileSync(
            filePath,
            'utf8'
        );

    if (
        !raw.trim()
    ) {
        return {
            version: 1,
            savedAt: null,
            entries: []
        };
    }

    const parsed =
        JSON.parse(
            raw
        );

    if (
        !parsed ||
        typeof parsed !== 'object'
    ) {
        throw new Error(
            'Arquivo de catálogo inválido.'
        );
    }

    if (
        !Array.isArray(
            parsed.entries
        )
    ) {
        throw new Error(
            'Arquivo de catálogo sem lista de produtos.'
        );
    }

    return parsed;
}


function loadCatalog(
    filePath =
        DEFAULT_STORE_FILE
) {
    const data =
        readCatalogFile(
            filePath
        );

    const catalog =
        createProductCatalog();

    for (
        const entry
        of data.entries
    ) {
        if (
            !entry ||
            !entry.product
        ) {
            continue;
        }

        catalog.addProduct(
            entry.product,
            {
                published:
                    entry.visibility
                        ?.published ??
                    false,

                featured:
                    entry.visibility
                        ?.featured ??
                    false,

                position:
                    entry.visibility
                        ?.position ??
                    null,

                collections:
                    entry.collections ||
                    [],

                marketing:
                    entry.marketing || {
                        selected: false,
                        selectedAt: null,
                        status:
                            'not_selected'
                    }
            }
        );
    }

    return catalog;
}


function createCatalogStore(
    options = {}
) {
    const filePath =
        options.filePath ||
        DEFAULT_STORE_FILE;


    function load() {
        return loadCatalog(
            filePath
        );
    }


    function save(catalog) {
        return writeCatalogFile(
            catalog,
            filePath
        );
    }


    function exists() {
        return fs.existsSync(
            filePath
        );
    }


    function getFilePath() {
        return filePath;
    }


    return {
        load,
        save,
        exists,
        getFilePath
    };
}


const defaultCatalogStore =
    createCatalogStore();


module.exports = {
    DEFAULT_STORE_FILE,
    ensureDirectory,
    serializeCatalog,
    writeCatalogFile,
    readCatalogFile,
    loadCatalog,
    createCatalogStore,
    defaultCatalogStore
};

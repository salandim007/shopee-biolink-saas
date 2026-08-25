'use strict';

const fs =
    require('fs');

const path =
    require('path');

const {
    getLatestCsvFile,
    readFeed
} = require('./feed-test');

const {
    translateCategory,
    translateSubcategory
} = require('./shopee-category-map');


const REGISTRY_FILE =
    path.join(
        __dirname,
        'data',
        'category-registry.json'
    );


// ============================================================
// CACHE DO DATA FEED
// ============================================================

let categoryIdIndexPromise =
    null;


// ============================================================
// UTILIDADES
// ============================================================

function normalizeId(
    value
) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const normalized =
        String(value)
            .trim();

    return normalized ||
        null;
}


function normalizeText(
    value
) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const normalized =
        String(value)
            .trim();

    return normalized ||
        null;
}


// ============================================================
// CATEGORY REGISTRY
// ============================================================

function loadCategoryRegistry() {
    if (
        !fs.existsSync(
            REGISTRY_FILE
        )
    ) {
        return {
            version: 1,
            updatedAt:
                new Date()
                    .toISOString(),

            categories: {}
        };
    }

    try {
        const content =
            fs.readFileSync(
                REGISTRY_FILE,
                'utf8'
            );

        const registry =
            JSON.parse(
                content
            );

        if (
            !registry.categories ||
            typeof registry.categories !==
                'object'
        ) {
            registry.categories = {};
        }

        return registry;
    } catch {
        throw new Error(
            'Não foi possível carregar data/category-registry.json.'
        );
    }
}


function saveCategoryRegistry(
    registry
) {
    registry.updatedAt =
        new Date()
            .toISOString();

    const tempFile =
        `${REGISTRY_FILE}.tmp`;

    fs.writeFileSync(
        tempFile,
        JSON.stringify(
            registry,
            null,
            2
        ),
        'utf8'
    );

    fs.renameSync(
        tempFile,
        REGISTRY_FILE
    );
}


// ============================================================
// REGISTRA CATEGORIAS NOVAS AUTOMATICAMENTE
// ============================================================

function ensureRegistryEntries(
    sourceNames
) {
    const category1 =
        normalizeText(
            sourceNames.category1
        );

    const category2 =
        normalizeText(
            sourceNames.category2
        );

    const category3 =
        normalizeText(
            sourceNames.category3
        );

    if (!category1) {
        return;
    }

    const registry =
        loadCategoryRegistry();

    let changed =
        false;


    // --------------------------------------------------------
    // NÍVEL 1
    // --------------------------------------------------------

    let categoryEntry =
        registry.categories[
            category1
        ];

    const categoryTranslation =
        translateCategory(
            category1
        );

    if (!categoryEntry) {
        categoryEntry = {
            sourceName:
                category1,

            displayName:
                categoryTranslation
                    ?.displayName ||
                category1,

            status:
                categoryTranslation
                    ?.translationStatus ||
                'pending',

            subcategories: {}
        };

        registry.categories[
            category1
        ] =
            categoryEntry;

        changed =
            true;
    } else {
        if (
            !categoryEntry.subcategories ||
            typeof categoryEntry
                .subcategories !==
                'object'
        ) {
            categoryEntry.subcategories = {};

            changed =
                true;
        }

        if (
            categoryEntry.status ===
                'pending' &&
            categoryTranslation
                ?.translationStatus ===
                'translated'
        ) {
            categoryEntry.displayName =
                categoryTranslation
                    .displayName;

            categoryEntry.status =
                'translated';

            changed =
                true;
        }
    }


    // --------------------------------------------------------
    // NÍVEL 2
    // --------------------------------------------------------

    let subcategoryEntry =
        null;

    if (category2) {
        const subcategoryTranslation =
            translateSubcategory(
                category2
            );

        subcategoryEntry =
            categoryEntry
                .subcategories[
                    category2
                ];

        if (!subcategoryEntry) {
            subcategoryEntry = {
                sourceName:
                    category2,

                displayName:
                    subcategoryTranslation
                        ?.displayName ||
                    category2,

                status:
                    subcategoryTranslation
                        ?.translationStatus ||
                    'pending',

                level3: {}
            };

            categoryEntry
                .subcategories[
                    category2
                ] =
                subcategoryEntry;

            changed =
                true;
        } else {
            if (
                !subcategoryEntry.level3 ||
                typeof subcategoryEntry
                    .level3 !==
                    'object'
            ) {
                subcategoryEntry.level3 = {};

                changed =
                    true;
            }

            if (
                subcategoryEntry.status ===
                    'pending' &&
                subcategoryTranslation
                    ?.translationStatus ===
                    'translated'
            ) {
                subcategoryEntry.displayName =
                    subcategoryTranslation
                        .displayName;

                subcategoryEntry.status =
                    'translated';

                changed =
                    true;
            }
        }
    }


    // --------------------------------------------------------
    // NÍVEL 3
    // --------------------------------------------------------

    if (
        category3 &&
        subcategoryEntry
    ) {
        const level3Entry =
            subcategoryEntry
                .level3[
                    category3
                ];

        if (!level3Entry) {
            subcategoryEntry
                .level3[
                    category3
                ] = {
                    sourceName:
                        category3,

                    /*
                     * Ainda não existe tradutor próprio
                     * de nível 3.
                     *
                     * Portanto o nome oficial da Shopee
                     * é mantido até ser traduzido.
                     */
                    displayName:
                        category3,

                    status:
                        'pending'
                };

            changed =
                true;
        }
    }


    if (changed) {
        saveCategoryRegistry(
            registry
        );
    }
}


// ============================================================
// CONSULTA NOMES DE EXIBIÇÃO NO REGISTRY
// ============================================================

function getRegistryDisplayNames(
    category1,
    category2,
    category3
) {
    const registry =
        loadCategoryRegistry();

    const category =
        category1
            ? registry
                .categories[
                    category1
                ]
            : null;

    const subcategory =
        category &&
        category2
            ? category
                .subcategories?.[
                    category2
                ]
            : null;

    const level3 =
        subcategory &&
        category3
            ? subcategory
                .level3?.[
                    category3
                ]
            : null;

    return {
        category1:
            normalizeText(
                category
                    ?.displayName
            ),

        category2:
            normalizeText(
                subcategory
                    ?.displayName
            ),

        category3:
            normalizeText(
                level3
                    ?.displayName
            )
    };
}


// ============================================================
// TRADUÇÃO / FALLBACK
// ============================================================

function translateResolvedNames(
    sourceNames
) {
    const category1Source =
        normalizeText(
            sourceNames.category1
        );

    const category2Source =
        normalizeText(
            sourceNames.category2
        );

    const category3Source =
        normalizeText(
            sourceNames.category3
        );


    /*
     * Garante primeiro que qualquer nome novo
     * descoberto no Data Feed seja registrado.
     */
    ensureRegistryEntries({
        category1:
            category1Source,

        category2:
            category2Source,

        category3:
            category3Source
    });


    const registryNames =
        getRegistryDisplayNames(
            category1Source,
            category2Source,
            category3Source
        );


    const translatedCategory =
        category1Source
            ? translateCategory(
                category1Source
            )
            : null;


    const translatedSubcategory =
        category2Source
            ? translateSubcategory(
                category2Source
            )
            : null;


    return {
        category1:
            registryNames.category1 ||
            translatedCategory
                ?.displayName ||
            category1Source ||
            null,

        category2:
            registryNames.category2 ||
            translatedSubcategory
                ?.displayName ||
            category2Source ||
            null,

        /*
         * Nível 3:
         *
         * usa tradução salva no Registry.
         * Caso ainda esteja pendente,
         * mantém o nome oficial da Shopee.
         */
        category3:
            registryNames.category3 ||
            category3Source ||
            null
    };
}


// ============================================================
// CONSTRÓI ÍNDICE DE IDs
// ============================================================

async function buildCategoryIdIndex() {
    const csvFile =
        getLatestCsvFile();

    const level1 =
        new Map();

    const level2 =
        new Map();

    const level3 =
        new Map();


    console.log(
        'Carregando índice de categorias do Data Feed...'
    );


    await readFeed(
        csvFile,
        row => {
            const id1 =
                normalizeId(
                    row.global_catid1
                );

            const name1 =
                normalizeText(
                    row.global_category1
                );


            const id2 =
                normalizeId(
                    row.global_catid2
                );

            const name2 =
                normalizeText(
                    row.global_category2
                );


            const id3 =
                normalizeId(
                    row.global_catid3
                );

            const name3 =
                normalizeText(
                    row.global_category3
                );


            if (
                id1 &&
                name1 &&
                !level1.has(id1)
            ) {
                level1.set(
                    id1,
                    name1
                );
            }


            if (
                id2 &&
                name2 &&
                !level2.has(id2)
            ) {
                level2.set(
                    id2,
                    name2
                );
            }


            if (
                id3 &&
                name3 &&
                !level3.has(id3)
            ) {
                level3.set(
                    id3,
                    name3
                );
            }


            /*
             * false:
             *
             * queremos percorrer o CSV inteiro UMA VEZ
             * para construir o índice completo.
             */
            return false;
        }
    );


    console.log(
        'Índice de categorias carregado.'
    );

    console.log(
        `Nível 1: ${level1.size}`
    );

    console.log(
        `Nível 2: ${level2.size}`
    );

    console.log(
        `Nível 3: ${level3.size}`
    );


    return {
        sourceFile:
            csvFile.name,

        level1,
        level2,
        level3
    };
}


// ============================================================
// CACHE
// ============================================================

async function getCategoryIdIndex() {
    if (!categoryIdIndexPromise) {
        categoryIdIndexPromise =
            buildCategoryIdIndex()
                .catch(
                    error => {
                        /*
                         * Se falhar, limpa a Promise.
                         * Assim uma próxima tentativa
                         * pode tentar carregar novamente.
                         */
                        categoryIdIndexPromise =
                            null;

                        throw error;
                    }
                );
    }

    return categoryIdIndexPromise;
}


// ============================================================
// RESOLVE productCatIds
// ============================================================

async function resolveCategoryIds(
    productCatIds
) {
    if (
        !Array.isArray(
            productCatIds
        ) ||
        productCatIds.length === 0
    ) {
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


    const categoryId1 =
        normalizeId(
            productCatIds[0]
        );

    const categoryId2 =
        normalizeId(
            productCatIds[1]
        );

    const categoryId3 =
        normalizeId(
            productCatIds[2]
        );


    const index =
        await getCategoryIdIndex();


    const sourceNames = {
        category1:
            categoryId1
                ? index.level1.get(
                    categoryId1
                ) || null
                : null,

        category2:
            categoryId2
                ? index.level2.get(
                    categoryId2
                ) || null
                : null,

        category3:
            categoryId3
                ? index.level3.get(
                    categoryId3
                ) || null
                : null
    };


    const translated =
        translateResolvedNames(
            sourceNames
        );


    return {
        category1:
            translated.category1,

        category2:
            translated.category2,

        category3:
            translated.category3,

        sourceCategory1:
            sourceNames.category1,

        sourceCategory2:
            sourceNames.category2,

        sourceCategory3:
            sourceNames.category3,

        categoryId1,
        categoryId2,
        categoryId3,

        sourceFile:
            index.sourceFile
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    resolveCategoryIds
};
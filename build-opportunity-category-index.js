'use strict';

const fs = require('fs');
const path = require('path');

const {
    getLatestCsvFile,
    readFeed
} = require('./feed-test');

const REGISTRY_FILE =
    path.join(
        __dirname,
        'data',
        'category-registry.json'
    );

const OUTPUT_FILE =
    path.join(
        __dirname,
        'tmp',
        'opportunity-category-index.json'
    );


function clean(value) {
    return String(
        value ?? ''
    )
        .replace(/\0/g, '')
        .trim();
}


function toId(value) {
    const text =
        clean(value);

    if (!text) {
        return null;
    }

    const number =
        Number(text);

    return Number.isFinite(number) &&
        number > 0
        ? number
        : null;
}


function loadRegistry() {
    return JSON.parse(
        fs.readFileSync(
            REGISTRY_FILE,
            'utf8'
        )
    );
}


function getDisplayNames(
    registry,
    category1,
    category2,
    category3
) {
    const category =
        registry.categories?.[
            category1
        ];

    const subcategory =
        category
            ?.subcategories?.[
                category2
            ];

    const level3 =
        subcategory
            ?.level3?.[
                category3
            ];

    return {
        category1:
            category?.displayName ||
            category1,

        category2:
            subcategory?.displayName ||
            category2 ||
            null,

        category3:
            level3?.displayName ||
            category3 ||
            null
    };
}


async function main() {
    const registry =
        loadRegistry();

    const csvFile =
        getLatestCsvFile();

    const categories =
        new Map();

    console.log(
        `Lendo feed: ${csvFile.name}`
    );

    await readFeed(
        csvFile,
        row => {
            const id1 =
                toId(
                    row.global_catid1
                );

            const id2 =
                toId(
                    row.global_catid2
                );

            const id3 =
                toId(
                    row.global_catid3
                );

            const source1 =
                clean(
                    row.global_category1
                );

            const source2 =
                clean(
                    row.global_category2
                );

            const source3 =
                clean(
                    row.global_category3
                );

            if (
                !id1 ||
                !source1
            ) {
                return false;
            }

            const display =
                getDisplayNames(
                    registry,
                    source1,
                    source2,
                    source3
                );

            if (
                !categories.has(id1)
            ) {
                categories.set(
                    id1,
                    {
                        id:
                            id1,

                        sourceName:
                            source1,

                        displayName:
                            display.category1,

                        productCount:
                            0,

                        subcategories:
                            new Map()
                    }
                );
            }

            const category =
                categories.get(
                    id1
                );

            category.productCount += 1;

            if (
                !id2 ||
                !source2
            ) {
                return false;
            }

            if (
                !category
                    .subcategories
                    .has(id2)
            ) {
                category
                    .subcategories
                    .set(
                        id2,
                        {
                            id:
                                id2,

                            sourceName:
                                source2,

                            displayName:
                                display.category2,

                            productCount:
                                0,

                            level3:
                                new Map()
                        }
                    );
            }

            const subcategory =
                category
                    .subcategories
                    .get(id2);

            subcategory.productCount += 1;

            if (
                !id3 ||
                !source3
            ) {
                return false;
            }

            if (
                !subcategory
                    .level3
                    .has(id3)
            ) {
                subcategory
                    .level3
                    .set(
                        id3,
                        {
                            id:
                                id3,

                            sourceName:
                                source3,

                            displayName:
                                display.category3,

                            productCount:
                                0
                        }
                    );
            }

            subcategory
                .level3
                .get(id3)
                .productCount += 1;

            return false;
        }
    );


    const result =
        Array
            .from(
                categories.values()
            )
            .map(
                category => ({
                    ...category,

                    subcategories:
                        Array
                            .from(
                                category
                                    .subcategories
                                    .values()
                            )
                            .map(
                                subcategory => ({
                                    ...subcategory,

                                    level3:
                                        Array
                                            .from(
                                                subcategory
                                                    .level3
                                                    .values()
                                            )
                                            .sort(
                                                (
                                                    a,
                                                    b
                                                ) =>
                                                    a.displayName
                                                        .localeCompare(
                                                            b.displayName,
                                                            'pt-BR'
                                                        )
                                            )
                                })
                            )
                            .sort(
                                (
                                    a,
                                    b
                                ) =>
                                    a.displayName
                                        .localeCompare(
                                            b.displayName,
                                            'pt-BR'
                                        )
                            )
                })
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    a.displayName
                        .localeCompare(
                            b.displayName,
                            'pt-BR'
                        )
            );


    const totals = {
        categories:
            result.length,

        subcategories:
            result.reduce(
                (
                    total,
                    category
                ) =>
                    total +
                    category
                        .subcategories
                        .length,
                0
            ),

        level3:
            result.reduce(
                (
                    total,
                    category
                ) =>
                    total +
                    category
                        .subcategories
                        .reduce(
                            (
                                subtotal,
                                subcategory
                            ) =>
                                subtotal +
                                subcategory
                                    .level3
                                    .length,
                            0
                        ),
                0
            )
    };


    const output = {
        generatedAt:
            new Date()
                .toISOString(),

        sourceFeed:
            csvFile.name,

        totals,

        categories:
            result
    };


    fs.mkdirSync(
        path.dirname(
            OUTPUT_FILE
        ),
        {
            recursive:
                true
        }
    );

    fs.writeFileSync(
        OUTPUT_FILE,
        JSON.stringify(
            output,
            null,
            2
        ),
        'utf8'
    );


    console.log('');
    console.log(
        '========================================'
    );

    console.log(
        'ÍNDICE DE CATEGORIAS GERADO'
    );

    console.log(
        '========================================'
    );

    console.log(
        'Categorias:',
        totals.categories
    );

    console.log(
        'Subcategorias:',
        totals.subcategories
    );

    console.log(
        'Nível 3:',
        totals.level3
    );

    console.log(
        'Arquivo:',
        OUTPUT_FILE
    );
}


main().catch(
    error => {
        console.error(
            'ERRO:',
            error.message
        );

        process.exit(1);
    }
);

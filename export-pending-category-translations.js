'use strict';

const fs =
    require('fs');

const path =
    require('path');


const REGISTRY_FILE =
    path.join(
        __dirname,
        'data',
        'category-registry.json'
    );

const OUTPUT_FILE =
    path.join(
        __dirname,
        'data',
        'category-translations-pending.json'
    );


function loadRegistry() {
    if (
        !fs.existsSync(
            REGISTRY_FILE
        )
    ) {
        throw new Error(
            'Arquivo data/category-registry.json não encontrado.'
        );
    }

    return JSON.parse(
        fs.readFileSync(
            REGISTRY_FILE,
            'utf8'
        )
    );
}


function main() {
    const registry =
        loadRegistry();

    const pending = [];

    let categoryCount = 0;
    let subcategoryCount = 0;
    let level3Count = 0;


    for (
        const [
            categoryKey,
            category
        ]
        of Object.entries(
            registry.categories || {}
        )
    ) {
        if (
            category.status ===
            'pending'
        ) {
            pending.push({
                level: 1,

                category:
                    categoryKey,

                parentCategory:
                    null,

                parentSubcategory:
                    null,

                sourceName:
                    category.sourceName ||
                    categoryKey,

                currentDisplayName:
                    category.displayName ||
                    category.sourceName ||
                    categoryKey,

                translation:
                    ''
            });

            categoryCount++;
        }


        for (
            const [
                subcategoryKey,
                subcategory
            ]
            of Object.entries(
                category.subcategories || {}
            )
        ) {
            if (
                subcategory.status ===
                'pending'
            ) {
                pending.push({
                    level: 2,

                    category:
                        categoryKey,

                    parentCategory:
                        category.sourceName ||
                        categoryKey,

                    parentSubcategory:
                        null,

                    sourceName:
                        subcategory.sourceName ||
                        subcategoryKey,

                    currentDisplayName:
                        subcategory.displayName ||
                        subcategory.sourceName ||
                        subcategoryKey,

                    translation:
                        ''
                });

                subcategoryCount++;
            }


            for (
                const [
                    level3Key,
                    level3
                ]
                of Object.entries(
                    subcategory.level3 || {}
                )
            ) {
                if (
                    level3.status ===
                    'pending'
                ) {
                    pending.push({
                        level: 3,

                        category:
                            categoryKey,

                        parentCategory:
                            category.sourceName ||
                            categoryKey,

                        parentSubcategory:
                            subcategory.sourceName ||
                            subcategoryKey,

                        sourceName:
                            level3.sourceName ||
                            level3Key,

                        currentDisplayName:
                            level3.displayName ||
                            level3.sourceName ||
                            level3Key,

                        translation:
                            ''
                    });

                    level3Count++;
                }
            }
        }
    }


    const output = {
        version: 1,

        generatedAt:
            new Date()
                .toISOString(),

        source:
            path.basename(
                REGISTRY_FILE
            ),

        language: {
            source:
                'en',

            target:
                'pt-BR'
        },

        summary: {
            categories:
                categoryCount,

            subcategories:
                subcategoryCount,

            level3:
                level3Count,

            total:
                pending.length
        },

        translations:
            pending
    };


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
        'CATEGORIAS PENDENTES EXPORTADAS'
    );

    console.log(
        '========================================'
    );

    console.log(
        `Categorias principais: ${categoryCount}`
    );

    console.log(
        `Subcategorias: ${subcategoryCount}`
    );

    console.log(
        `Nível 3: ${level3Count}`
    );

    console.log(
        `Total: ${pending.length}`
    );

    console.log('');

    console.log(
        `Arquivo: ${OUTPUT_FILE}`
    );

    console.log(
        '========================================'
    );
}


try {
    main();
} catch (error) {
    console.error('');
    console.error(
        'ERRO:'
    );

    console.error(
        error.message ||
        error
    );

    process.exitCode = 1;
}
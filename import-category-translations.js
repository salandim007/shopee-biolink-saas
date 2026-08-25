'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_FILE =
    path.join(
        __dirname,
        'data',
        'category-registry.json'
    );

const TRANSLATIONS_FILE =
    path.join(
        __dirname,
        'data',
        'category-translations-complete.json'
    );


function loadJson(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `Arquivo não encontrado: ${filePath}`
        );
    }

    return JSON.parse(
        fs.readFileSync(
            filePath,
            'utf8'
        )
    );
}


function saveJson(
    filePath,
    data
) {
    const tempFile =
        `${filePath}.tmp`;

    fs.writeFileSync(
        tempFile,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    );

    fs.renameSync(
        tempFile,
        filePath
    );
}


function applyTranslation(
    registry,
    item
) {
    const sourceName =
        String(
            item.sourceName || ''
        ).trim();

    const translation =
        String(
            item.translation || ''
        ).trim();

    if (
        !sourceName ||
        !translation
    ) {
        return {
            updated: false,
            reason: 'missing-data'
        };
    }


    // ========================================================
    // NÍVEL 1
    // ========================================================

    if (item.level === 1) {
        const category =
            registry.categories?.[
                sourceName
            ];

        if (!category) {
            return {
                updated: false,
                reason: 'not-found'
            };
        }

        category.displayName =
            translation;

        category.status =
            'translated';

        return {
            updated: true
        };
    }


    // ========================================================
    // NÍVEL 2
    // ========================================================

    if (item.level === 2) {
        const categoryKey =
            item.category;

        const category =
            registry.categories?.[
                categoryKey
            ];

        const subcategory =
            category
                ?.subcategories?.[
                    sourceName
                ];

        if (!subcategory) {
            return {
                updated: false,
                reason: 'not-found'
            };
        }

        subcategory.displayName =
            translation;

        subcategory.status =
            'translated';

        return {
            updated: true
        };
    }


    // ========================================================
    // NÍVEL 3
    // ========================================================

    if (item.level === 3) {
        const categoryKey =
            item.category;

        const subcategoryKey =
            item.parentSubcategory;

        const category =
            registry.categories?.[
                categoryKey
            ];

        const subcategory =
            category
                ?.subcategories?.[
                    subcategoryKey
                ];

        const level3 =
            subcategory
                ?.level3?.[
                    sourceName
                ];

        if (!level3) {
            return {
                updated: false,
                reason: 'not-found'
            };
        }

        level3.displayName =
            translation;

        level3.status =
            'translated';

        return {
            updated: true
        };
    }


    return {
        updated: false,
        reason: 'invalid-level'
    };
}


function main() {
    const registry =
        loadJson(
            REGISTRY_FILE
        );

    const translationsFile =
        loadJson(
            TRANSLATIONS_FILE
        );

    const translations =
        Array.isArray(
            translationsFile.translations
        )
            ? translationsFile.translations
            : [];


    let updated =
        0;

    let missing =
        0;

    let invalid =
        0;


    for (
        const item
        of translations
    ) {
        const result =
            applyTranslation(
                registry,
                item
            );

        if (result.updated) {
            updated++;
            continue;
        }

        if (
            result.reason ===
            'not-found'
        ) {
            missing++;
            continue;
        }

        invalid++;
    }


    registry.updatedAt =
        new Date()
            .toISOString();


    saveJson(
        REGISTRY_FILE,
        registry
    );


    console.log('');
    console.log(
        '========================================'
    );

    console.log(
        'IMPORTAÇÃO DE TRADUÇÕES CONCLUÍDA'
    );

    console.log(
        '========================================'
    );

    console.log(
        `Total recebido: ${translations.length}`
    );

    console.log(
        `Atualizados: ${updated}`
    );

    console.log(
        `Não encontrados: ${missing}`
    );

    console.log(
        `Inválidos: ${invalid}`
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
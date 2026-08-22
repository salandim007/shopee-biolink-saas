const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = path.join(
    __dirname,
    'data',
    'category-registry.json'
);

function loadRegistry() {
    if (!fs.existsSync(REGISTRY_FILE)) {
        throw new Error(
            `Category Registry não encontrado:\n${REGISTRY_FILE}\n` +
            'Execute primeiro: node build-category-registry.js'
        );
    }

    return JSON.parse(
        fs.readFileSync(
            REGISTRY_FILE,
            'utf8'
        )
    );
}

function sortByDisplayName(items) {
    return items.sort((a, b) =>
        String(a.displayName || a.sourceName)
            .localeCompare(
                String(b.displayName || b.sourceName),
                'pt-BR'
            )
    );
}

function getCategories() {
    const registry = loadRegistry();

    const categories = Object.values(
        registry.categories || {}
    ).map(category => ({
        sourceName: category.sourceName,
        displayName: category.displayName,
        status: category.status
    }));

    return sortByDisplayName(categories);
}

function getSubcategories(categorySourceName) {
    const registry = loadRegistry();

    const category =
        registry.categories?.[categorySourceName];

    if (!category) {
        return [];
    }

    const subcategories = Object.values(
        category.subcategories || {}
    ).map(subcategory => ({
        sourceName: subcategory.sourceName,
        displayName: subcategory.displayName,
        status: subcategory.status
    }));

    return sortByDisplayName(subcategories);
}

function getLevel3(
    categorySourceName,
    subcategorySourceName
) {
    const registry = loadRegistry();

    const category =
        registry.categories?.[categorySourceName];

    if (!category) {
        return [];
    }

    const subcategory =
        category.subcategories?.[
            subcategorySourceName
        ];

    if (!subcategory) {
        return [];
    }

    const level3 = Object.values(
        subcategory.level3 || {}
    ).map(item => ({
        sourceName: item.sourceName,
        displayName: item.displayName,
        status: item.status
    }));

    return sortByDisplayName(level3);
}

function getRegistryInfo() {
    const registry = loadRegistry();

    let categories = 0;
    let subcategories = 0;
    let level3 = 0;

    let pendingCategories = 0;
    let pendingSubcategories = 0;
    let pendingLevel3 = 0;

    for (
        const category
        of Object.values(
            registry.categories || {}
        )
    ) {
        categories++;

        if (category.status === 'pending') {
            pendingCategories++;
        }

        for (
            const subcategory
            of Object.values(
                category.subcategories || {}
            )
        ) {
            subcategories++;

            if (
                subcategory.status === 'pending'
            ) {
                pendingSubcategories++;
            }

            for (
                const item
                of Object.values(
                    subcategory.level3 || {}
                )
            ) {
                level3++;

                if (item.status === 'pending') {
                    pendingLevel3++;
                }
            }
        }
    }

    return {
        updatedAt: registry.updatedAt,
        sourceFile: registry.sourceFile,

        categories,
        subcategories,
        level3,

        pendingCategories,
        pendingSubcategories,
        pendingLevel3
    };
}

module.exports = {
    loadRegistry,
    getCategories,
    getSubcategories,
    getLevel3,
    getRegistryInfo
};
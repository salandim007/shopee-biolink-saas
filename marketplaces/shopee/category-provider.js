'use strict';

const fs = require('fs');
const path = require('path');

const MARKETPLACE = 'shopee';

const CATEGORY_INDEX_FILE =
    path.join(
        __dirname,
        '..',
        '..',
        'tmp',
        'opportunity-category-index.json'
    );


function loadCategoryIndex() {
    if (
        !fs.existsSync(
            CATEGORY_INDEX_FILE
        )
    ) {
        throw new Error(
            'Índice de categorias da Shopee não encontrado.'
        );
    }

    const content =
        fs.readFileSync(
            CATEGORY_INDEX_FILE,
            'utf8'
        );

    return JSON.parse(
        content
    );
}


function normalizeText(value) {
    return String(
        value || ''
    )
        .normalize('NFD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .toLowerCase()
        .trim();
}


function listCategories() {
    const index =
        loadCategoryIndex();

    return index.categories || [];
}


function searchCategories(term) {
    const query =
        normalizeText(
            term
        );

    if (!query) {
        return [];
    }

    const results = [];

    const categories =
        listCategories();

    for (
        const category
        of categories
    ) {
        if (
            normalizeText(
                category.displayName
            ).includes(query) ||
            normalizeText(
                category.sourceName
            ).includes(query)
        ) {
            results.push({
                marketplace:
                    MARKETPLACE,

                level:
                    1,

                id:
                    category.id,

                sourceName:
                    category.sourceName,

                displayName:
                    category.displayName
            });
        }

        for (
            const subcategory
            of category.subcategories || []
        ) {
            if (
                normalizeText(
                    subcategory.displayName
                ).includes(query) ||
                normalizeText(
                    subcategory.sourceName
                ).includes(query)
            ) {
                results.push({
                    marketplace:
                        MARKETPLACE,

                    level:
                        2,

                    id:
                        subcategory.id,

                    sourceName:
                        subcategory.sourceName,

                    displayName:
                        subcategory.displayName,

                    parent: {
                        id:
                            category.id,

                        displayName:
                            category.displayName
                    }
                });
            }

            for (
                const level3
                of subcategory.level3 || []
            ) {
                if (
                    normalizeText(
                        level3.displayName
                    ).includes(query) ||
                    normalizeText(
                        level3.sourceName
                    ).includes(query)
                ) {
                    results.push({
                        marketplace:
                            MARKETPLACE,

                        level:
                            3,

                        id:
                            level3.id,

                        sourceName:
                            level3.sourceName,

                        displayName:
                            level3.displayName,

                        parent: {
                            id:
                                subcategory.id,

                            displayName:
                                subcategory.displayName
                        },

                        root: {
                            id:
                                category.id,

                            displayName:
                                category.displayName
                        }
                    });
                }
            }
        }
    }

    return results;
}


function findCategoryById(categoryId) {
    const targetId =
        Number(
            categoryId
        );

    const categories =
        listCategories();

    for (
        const category
        of categories
    ) {
        if (
            Number(
                category.id
            ) === targetId
        ) {
            return {
                marketplace:
                    MARKETPLACE,

                level:
                    1,

                ...category
            };
        }

        for (
            const subcategory
            of category.subcategories || []
        ) {
            if (
                Number(
                    subcategory.id
                ) === targetId
            ) {
                return {
                    marketplace:
                        MARKETPLACE,

                    level:
                        2,

                    ...subcategory,

                    parent: {
                        id:
                            category.id,

                        displayName:
                            category.displayName
                    }
                };
            }

            for (
                const level3
                of subcategory.level3 || []
            ) {
                if (
                    Number(
                        level3.id
                    ) === targetId
                ) {
                    return {
                        marketplace:
                            MARKETPLACE,

                        level:
                            3,

                        ...level3,

                        parent: {
                            id:
                                subcategory.id,

                            displayName:
                                subcategory.displayName
                        },

                        root: {
                            id:
                                category.id,

                            displayName:
                                category.displayName
                        }
                    };
                }
            }
        }
    }

    return null;
}


module.exports = {
    marketplace:
        MARKETPLACE,

    listCategories,
    searchCategories,
    findCategoryById
};

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const {
    translateCategory,
    translateSubcategory
} = require('./shopee-category-map');

const {
    createCatalogProduct
} = require('./product-normalizer');

const FEED_DIR = path.join(
    __dirname,
    'data',
    'shopee-feed'
);

const MAX_RESULTS = 20;

function getLatestCsvFile() {
    if (!fs.existsSync(FEED_DIR)) {
        throw new Error(
            `Pasta de feeds não encontrada:\n${FEED_DIR}`
        );
    }

    const files = fs
        .readdirSync(FEED_DIR)
        .filter(file =>
            file.toLowerCase().endsWith('.csv')
        )
        .map(file => {
            const fullPath = path.join(
                FEED_DIR,
                file
            );

            const stats = fs.statSync(fullPath);

            return {
                name: file,
                fullPath,
                modifiedAt: stats.mtimeMs,
                size: stats.size
            };
        })
        .sort(
            (a, b) =>
                b.modifiedAt -
                a.modifiedAt
        );

    if (files.length === 0) {
        throw new Error(
            `Nenhum arquivo CSV encontrado em:\n${FEED_DIR}`
        );
    }

    return files[0];
}

function parseCsvRecord(record) {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < record.length; i++) {
        const char = record[i];
        const next = record[i + 1];

        if (
            char === '"' &&
            insideQuotes &&
            next === '"'
        ) {
            current += '"';
            i++;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (
            char === ',' &&
            !insideQuotes
        ) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);

    return values;
}

function isCompleteCsvRecord(text) {
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        if (text[i] !== '"') {
            continue;
        }

        if (
            insideQuotes &&
            i + 1 < text.length &&
            text[i + 1] === '"'
        ) {
            i++;
            continue;
        }

        insideQuotes = !insideQuotes;
    }

    return !insideQuotes;
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

function extractShopeeIds(productLink) {
    const match =
        String(productLink || '')
            .match(
                /\/product\/(\d+)\/(\d+)/
            );

    return {
        shopId:
            match
                ? match[1]
                : null,

        itemId:
            match
                ? match[2]
                : null
    };
}

function getArgumentValue(
    args,
    name
) {
    const index =
        args.indexOf(name);

    if (
        index === -1 ||
        !args[index + 1]
    ) {
        return null;
    }

    return args[index + 1];
}

function getArguments() {
    const args =
        process.argv.slice(2);

    return {
        listCategories:
            args.includes(
                '--listar-categorias'
            ),

        listSubcategories:
            args.includes(
                '--listar-subcategorias'
            ),

        listLevel3:
            args.includes(
                '--listar-nivel3'
            ),

        listPending:
            args.includes(
                '--listar-pendentes'
            ),

        category:
            getArgumentValue(
                args,
                '--categoria'
            ),

        subcategory:
            getArgumentValue(
                args,
                '--subcategoria'
            ),

        itemId:
            getArgumentValue(
                args,
                '--item'
            ),

        title:
            getArgumentValue(
                args,
                '--titulo'
            )
    };
}

async function readFeed(
    csvFile,
    callback
) {
    const stream =
        fs.createReadStream(
            csvFile.fullPath,
            {
                encoding: 'utf8'
            }
        );

    const rl =
        readline.createInterface({
            input: stream,
            crlfDelay: Infinity
        });

    let headers = null;
    let buffer = '';

    for await (const line of rl) {
        buffer = buffer
            ? `${buffer}\n${line}`
            : line;

        if (
            !isCompleteCsvRecord(
                buffer
            )
        ) {
            continue;
        }

        const record = buffer;
        buffer = '';

        if (!headers) {
            headers =
                parseCsvRecord(
                    record
                );

            headers[0] =
                headers[0]
                    .replace(
                        /^\uFEFF/,
                        ''
                    );

            continue;
        }

        const values =
            parseCsvRecord(
                record
            );

        const row = {};

        headers.forEach(
            (
                header,
                index
            ) => {
                row[header] =
                    values[index] ?? '';
            }
        );

        const shouldStop =
            await callback(row);

        if (
            shouldStop === true
        ) {
            break;
        }
    }

    rl.close();
    stream.destroy();
}

async function listCategories(
    csvFile
) {
    const categories =
        new Set();

    console.log('');
    console.log(
        'Lendo categorias do feed...'
    );
    console.log('');

    await readFeed(
        csvFile,
        row => {
            const category =
                String(
                    row.global_category1 || ''
                ).trim();

            if (category) {
                categories.add(
                    category
                );
            }
        }
    );

    const result = [
        ...categories
    ].sort((a, b) =>
        a.localeCompare(
            b,
            'pt-BR'
        )
    );

    console.log(
        '========================================'
    );
    console.log(
        'CATEGORIAS SHOPEE / VITRINE'
    );
    console.log(
        '========================================'
    );

    result.forEach(
        (
            sourceName,
            index
        ) => {
            const translated =
                translateCategory(
                    sourceName
                );

            console.log('');
            console.log(
                `${String(
                    index + 1
                ).padStart(
                    3,
                    ' '
                )}. SHOPEE: ${translated.sourceName}`
            );

            console.log(
                `     VITRINE: ${translated.displayName}`
            );

            console.log(
                `     STATUS: ${translated.translationStatus}`
            );
        }
    );

    console.log('');
    console.log(
        `Total de categorias: ${result.length}`
    );
}

async function listSubcategories(
    csvFile,
    categoryFilter
) {
    if (!categoryFilter) {
        throw new Error(
            'Informe a categoria com --categoria.'
        );
    }

    const subcategories =
        new Set();

    console.log('');
    console.log(
        `Lendo subcategorias de "${categoryFilter}"...`
    );
    console.log('');

    await readFeed(
        csvFile,
        row => {
            const category =
                String(
                    row.global_category1 || ''
                ).trim();

            if (
                normalizeText(category) !==
                normalizeText(
                    categoryFilter
                )
            ) {
                return;
            }

            const subcategory =
                String(
                    row.global_category2 || ''
                ).trim();

            if (subcategory) {
                subcategories.add(
                    subcategory
                );
            }
        }
    );

    const result = [
        ...subcategories
    ].sort((a, b) =>
        a.localeCompare(
            b,
            'pt-BR'
        )
    );

    const translatedCategory =
        translateCategory(
            categoryFilter
        );

    console.log(
        '========================================'
    );
    console.log(
        'SUBCATEGORIAS SHOPEE / VITRINE'
    );
    console.log(
        '========================================'
    );

    console.log(
        `Categoria Shopee: ${translatedCategory.sourceName}`
    );

    console.log(
        `Categoria Vitrine: ${translatedCategory.displayName}`
    );

    console.log('');

    result.forEach(
        (
            sourceName,
            index
        ) => {
            const translated =
                translateSubcategory(
                    sourceName
                );

            console.log(
                `${String(
                    index + 1
                ).padStart(
                    3,
                    ' '
                )}. SHOPEE: ${translated.sourceName}`
            );

            console.log(
                `     VITRINE: ${translated.displayName}`
            );

            console.log(
                `     STATUS: ${translated.translationStatus}`
            );

            console.log('');
        }
    );

    console.log(
        `Total de subcategorias: ${result.length}`
    );
}

async function listLevel3(
    csvFile,
    categoryFilter,
    subcategoryFilter
) {
    if (!categoryFilter) {
        throw new Error(
            'Informe a categoria com --categoria.'
        );
    }

    if (!subcategoryFilter) {
        throw new Error(
            'Informe a subcategoria com --subcategoria.'
        );
    }

    const level3Set =
        new Set();

    console.log('');
    console.log(
        `Lendo nível 3 de "${categoryFilter}" > "${subcategoryFilter}"...`
    );
    console.log('');

    await readFeed(
        csvFile,
        row => {
            const category =
                String(
                    row.global_category1 || ''
                ).trim();

            const subcategory =
                String(
                    row.global_category2 || ''
                ).trim();

            if (
                normalizeText(category) !==
                normalizeText(
                    categoryFilter
                )
            ) {
                return;
            }

            if (
                normalizeText(subcategory) !==
                normalizeText(
                    subcategoryFilter
                )
            ) {
                return;
            }

            const level3 =
                String(
                    row.global_category3 || ''
                ).trim();

            if (level3) {
                level3Set.add(
                    level3
                );
            }
        }
    );

    const result = [
        ...level3Set
    ].sort((a, b) =>
        a.localeCompare(
            b,
            'pt-BR'
        )
    );

    console.log(
        '========================================'
    );
    console.log(
        'CATEGORIAS NÍVEL 3 SHOPEE'
    );
    console.log(
        '========================================'
    );

    console.log(
        `Categoria: ${categoryFilter}`
    );

    console.log(
        `Subcategoria: ${subcategoryFilter}`
    );

    console.log('');

    result.forEach(
        (
            name,
            index
        ) => {
            console.log(
                `${String(
                    index + 1
                ).padStart(
                    3,
                    ' '
                )}. ${name}`
            );
        }
    );

    console.log('');
    console.log(
        `Total nível 3: ${result.length}`
    );
}
async function listPending(
    csvFile
) {
    const pendingCategories =
        new Set();

    const pendingSubcategories =
        new Map();

    const level3Values =
        new Map();

    console.log('');
    console.log(
        'Varrendo feed completo para localizar traduções pendentes...'
    );
    console.log('');

    await readFeed(
        csvFile,
        row => {
            const categorySource =
                String(
                    row.global_category1 || ''
                ).trim();

            const subcategorySource =
                String(
                    row.global_category2 || ''
                ).trim();

            const level3Source =
                String(
                    row.global_category3 || ''
                ).trim();

            if (categorySource) {
                const category =
                    translateCategory(
                        categorySource
                    );

                if (
                    category.translationStatus ===
                    'pending'
                ) {
                    pendingCategories.add(
                        categorySource
                    );
                }
            }

            if (
                categorySource &&
                subcategorySource
            ) {
                const subcategory =
                    translateSubcategory(
                        subcategorySource
                    );

                if (
                    subcategory.translationStatus ===
                    'pending'
                ) {
                    if (
                        !pendingSubcategories.has(
                            categorySource
                        )
                    ) {
                        pendingSubcategories.set(
                            categorySource,
                            new Set()
                        );
                    }

                    pendingSubcategories
                        .get(
                            categorySource
                        )
                        .add(
                            subcategorySource
                        );
                }
            }

            if (
                categorySource &&
                subcategorySource &&
                level3Source
            ) {
                const key =
                    `${categorySource}|||${subcategorySource}`;

                if (
                    !level3Values.has(
                        key
                    )
                ) {
                    level3Values.set(
                        key,
                        new Set()
                    );
                }

                level3Values
                    .get(key)
                    .add(
                        level3Source
                    );
            }
        }
    );

    console.log(
        '========================================'
    );
    console.log(
        'CATEGORIAS PRINCIPAIS PENDENTES'
    );
    console.log(
        '========================================'
    );

    const categories =
        [...pendingCategories]
            .sort((a, b) =>
                a.localeCompare(
                    b,
                    'pt-BR'
                )
            );

    if (
        categories.length ===
        0
    ) {
        console.log(
            'Nenhuma categoria principal pendente.'
        );
    } else {
        categories.forEach(
            (
                name,
                index
            ) => {
                console.log(
                    `${index + 1}. ${name}`
                );
            }
        );
    }

    console.log('');
    console.log(
        `Total categorias pendentes: ${categories.length}`
    );

    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        'SUBCATEGORIAS PENDENTES'
    );
    console.log(
        '========================================'
    );

    let totalPendingSubcategories =
        0;

    const sortedCategoryEntries =
        [
            ...pendingSubcategories
                .entries()
        ].sort(
            (
                [categoryA],
                [categoryB]
            ) =>
                categoryA.localeCompare(
                    categoryB,
                    'pt-BR'
                )
        );

    if (
        sortedCategoryEntries.length ===
        0
    ) {
        console.log(
            'Nenhuma subcategoria pendente.'
        );
    }

    for (
        const [
            category,
            subcategorySet
        ] of sortedCategoryEntries
    ) {
        const translatedCategory =
            translateCategory(
                category
            );

        console.log('');
        console.log(
            `${category} -> ${translatedCategory.displayName}`
        );

        const subcategories =
            [...subcategorySet]
                .sort((a, b) =>
                    a.localeCompare(
                        b,
                        'pt-BR'
                    )
                );

        subcategories.forEach(
            subcategory => {
                totalPendingSubcategories++;

                console.log(
                    `  - ${subcategory}`
                );
            }
        );
    }

    console.log('');
    console.log(
        `Total subcategorias pendentes: ${totalPendingSubcategories}`
    );

    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        'RESUMO NÍVEL 3'
    );
    console.log(
        '========================================'
    );

    let totalLevel3 =
        0;

    for (
        const values
        of level3Values.values()
    ) {
        totalLevel3 +=
            values.size;
    }

    console.log(
        `Combinações categoria/subcategoria com nível 3: ${level3Values.size}`
    );

    console.log(
        `Total de nomes únicos encontrados no nível 3 por combinação: ${totalLevel3}`
    );

    console.log('');
    console.log(
        'Observação: o nível 3 ainda não está sendo traduzido.'
    );
}

function rowMatches(
    row,
    options
) {
    if (
        options.itemId &&
        String(
            row.itemid
        ) !==
            String(
                options.itemId
            )
    ) {
        return false;
    }

    if (
        options.category &&
        !normalizeText(
            row.global_category1
        ).includes(
            normalizeText(
                options.category
            )
        )
    ) {
        return false;
    }

    if (
        options.subcategory &&
        !normalizeText(
            row.global_category2
        ).includes(
            normalizeText(
                options.subcategory
            )
        )
    ) {
        return false;
    }

    if (
        options.title &&
        !normalizeText(
            row.title
        ).includes(
            normalizeText(
                options.title
            )
        )
    ) {
        return false;
    }

    return true;
}

function normalizeFeedProduct(row) {
    const ids =
        extractShopeeIds(
            row.product_link
        );

    const category =
        translateCategory(
            row.global_category1
        );

    const subcategory =
        translateSubcategory(
            row.global_category2
        );

    const originalPrice =
        toNumber(
            row.price
        );

    const salePrice =
        toNumber(
            row.sale_price
        );

    const currentPrice =
        salePrice > 0
            ? salePrice
            : originalPrice;

    const validOriginalPrice =
        originalPrice > currentPrice
            ? originalPrice
            : null;

    return createCatalogProduct({
        source:
            'shopee_csv',

        marketplace:
            'shopee',

        itemId:
            String(
                row.itemid ||
                ids.itemId ||
                ''
            ),

        shopId:
            ids.shopId,

        title:
            row.title || null,

        description:
            row.description || null,

        price:
            currentPrice,

        originalPrice:
            validOriginalPrice,

        minPrice:
            currentPrice,

        maxPrice:
            currentPrice,

        currency:
            'BRL',

        image:
            row.image_link || null,

        video:
            null,

        shopName:
            row.shop_name ||
            row.shopName ||
            null,

        commissionRate:
            row.commission_rate ||
            row.commissionRate ||
            null,

        category1:
            row.global_category1 ||
            null,

        category2:
            row.global_category2 ||
            null,

        category3:
            row.global_category3 ||
            null,

        originalUrl:
            row.product_link ||
            null,

        resolvedUrl:
            row.product_link ||
            null,

        affiliateLink:
            row['product_short link'] ||
            row.product_link ||
            null,

        available:
            null,

        metadata: {
            provider:
                'Shopee Data Feed CSV',

            categoryDisplayName:
                category.displayName,

            categoryTranslationStatus:
                category.translationStatus,

            subcategoryDisplayName:
                subcategory.displayName,

            subcategoryTranslationStatus:
                subcategory.translationStatus,

            discountPercentage:
                toNumber(
                    row.discount_percentage
                ),

            rating:
                toNumber(
                    row.item_rating
                )
        }
    });
}

function printProduct(
    row,
    number
) {
    const ids =
        extractShopeeIds(
            row.product_link
        );

    const category =
        translateCategory(
            row.global_category1
        );

    const subcategory =
        translateSubcategory(
            row.global_category2
        );

    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        `PRODUTO ${number}`
    );
    console.log(
        '========================================'
    );

    console.log(
        `SHOP ID: ${ids.shopId}`
    );

    console.log(
        `ITEM ID: ${row.itemid}`
    );

    console.log('');
    console.log(
        `TÍTULO: ${row.title}`
    );

    console.log('');
    console.log(
        `PREÇO ORIGINAL: R$ ${toNumber(
            row.price
        ).toFixed(2)}`
    );

    console.log(
        `PREÇO PROMOCIONAL: R$ ${toNumber(
            row.sale_price
        ).toFixed(2)}`
    );

    console.log(
        `DESCONTO: ${toNumber(
            row.discount_percentage
        )}%`
    );

    console.log(
        `AVALIAÇÃO: ${toNumber(
            row.item_rating
        )}`
    );

    console.log('');

    console.log(
        `CATEGORIA SHOPEE: ${category.sourceName}`
    );

    console.log(
        `CATEGORIA VITRINE: ${category.displayName}`
    );

    console.log(
        `STATUS CATEGORIA: ${category.translationStatus}`
    );

    console.log('');

    console.log(
        `SUBCATEGORIA SHOPEE: ${subcategory.sourceName}`
    );

    console.log(
        `SUBCATEGORIA VITRINE: ${subcategory.displayName}`
    );

    console.log(
        `STATUS SUBCATEGORIA: ${subcategory.translationStatus}`
    );

    console.log('');

    console.log(
        `CATEGORIA 3 SHOPEE: ${row.global_category3}`
    );

    console.log('');

    console.log(
        `LINK PRODUTO: ${row.product_link}`
    );

    console.log(
        `LINK AFILIADO: ${row['product_short link']}`
    );

    const catalogProduct =
        normalizeFeedProduct(
            row
        );

    console.log('');
    console.log(
        '----------------------------------------'
    );
    console.log(
        'PRODUTO DO CATÁLOGO NORMALIZADO'
    );
    console.log(
        '----------------------------------------'
    );

    console.dir(
        catalogProduct,
        {
            depth: null,
            colors: true
        }
    );
}
async function searchProducts(
    csvFile,
    options
) {
    let matches = 0;

    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        'PESQUISA DE PRODUTOS'
    );
    console.log(
        '========================================'
    );

    console.log(
        `ITEM: ${options.itemId || '(todos)'}`
    );

    console.log(
        `CATEGORIA: ${options.category || '(todas)'}`
    );

    console.log(
        `SUBCATEGORIA: ${options.subcategory || '(todas)'}`
    );

    console.log(
        `TÍTULO: ${options.title || '(todos)'}`
    );

    await readFeed(
        csvFile,
        row => {
            if (!row.itemid) {
                return false;
            }

            if (
                !rowMatches(
                    row,
                    options
                )
            ) {
                return false;
            }

            matches++;

            printProduct(
                row,
                matches
            );

            if (
                options.itemId
            ) {
                return true;
            }

            return (
                matches >=
                MAX_RESULTS
            );
        }
    );

    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        'PESQUISA FINALIZADA'
    );
    console.log(
        '========================================'
    );

    console.log(
        `Produtos encontrados: ${matches}`
    );
}

async function main() {
    const options =
        getArguments();

    const csvFile =
        getLatestCsvFile();

    console.log(
        '========================================'
    );
    console.log(
        'SHOPEE FEED - EXPLORADOR'
    );
    console.log(
        '========================================'
    );

    console.log(
        `Pasta: ${FEED_DIR}`
    );

    console.log(
        `CSV selecionado automaticamente: ${csvFile.name}`
    );

    console.log(
        `Tamanho: ${(csvFile.size / 1024 / 1024).toFixed(2)} MB`
    );

    if (
        options.listCategories
    ) {
        await listCategories(
            csvFile
        );
        return;
    }

    if (
        options.listSubcategories
    ) {
        await listSubcategories(
            csvFile,
            options.category
        );
        return;
    }

    if (
        options.listLevel3
    ) {
        await listLevel3(
            csvFile,
            options.category,
            options.subcategory
        );
        return;
    }

    if (
        options.listPending
    ) {
        await listPending(
            csvFile
        );
        return;
    }

    if (
        options.itemId ||
        options.category ||
        options.subcategory ||
        options.title
    ) {
        await searchProducts(
            csvFile,
            options
        );
        return;
    }

    console.log('');
    console.log(
        'Nenhuma operação informada.'
    );

    console.log('');
    console.log('Exemplos:');

    console.log(
        'node feed-test.js --listar-categorias'
    );

    console.log(
        'node feed-test.js --listar-subcategorias --categoria "Men Clothes"'
    );

    console.log(
        'node feed-test.js --listar-nivel3 --categoria "Men Clothes" --subcategoria "Pants"'
    );

    console.log(
        'node feed-test.js --listar-pendentes'
    );

    console.log(
        'node feed-test.js --item 9659554077'
    );
}

if (require.main === module) {
    main().catch(error => {
        console.error('');
        console.error('ERRO:');
        console.error(
            error.message
        );

        if (
            Array.isArray(
                error.validationErrors
            )
        ) {
            console.error('');
            console.error(
                'ERROS DE VALIDAÇÃO:'
            );

            for (
                const validationError
                of error.validationErrors
            ) {
                console.error(
                    `- ${validationError}`
                );
            }
        }

        process.exitCode = 1;
    });
}

module.exports = {
    getLatestCsvFile,
    parseCsvRecord,
    isCompleteCsvRecord,
    extractShopeeIds,
    readFeed,
    rowMatches,
    normalizeFeedProduct
};
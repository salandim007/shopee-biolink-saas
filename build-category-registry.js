const fs = require('fs');
const path = require('path');
const readline = require('readline');

const {
    translateCategory,
    translateSubcategory
} = require('./shopee-category-map');

const FEED_DIR = path.join(
    __dirname,
    'data',
    'shopee-feed'
);

const REGISTRY_FILE = path.join(
    __dirname,
    'data',
    'category-registry.json'
);

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
                b.modifiedAt - a.modifiedAt
        );

    if (files.length === 0) {
        throw new Error(
            `Nenhum CSV encontrado em:\n${FEED_DIR}`
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

function loadExistingRegistry() {
    if (!fs.existsSync(REGISTRY_FILE)) {
        return {
            version: 1,
            updatedAt: null,
            sourceFile: null,
            categories: {}
        };
    }

    const content = fs.readFileSync(
        REGISTRY_FILE,
        'utf8'
    );

    return JSON.parse(content);
}

function ensureCategory(
    registry,
    sourceName
) {
    if (!sourceName) {
        return null;
    }

    if (!registry.categories[sourceName]) {
        const translated =
            translateCategory(sourceName);

        registry.categories[sourceName] = {
            sourceName,
            displayName:
                translated.displayName,
            status:
                translated.translationStatus,
            subcategories: {}
        };
    }

    return registry.categories[sourceName];
}

function ensureSubcategory(
    category,
    sourceName
) {
    if (!sourceName) {
        return null;
    }

    if (
        !category.subcategories[sourceName]
    ) {
        const translated =
            translateSubcategory(sourceName);

        category.subcategories[sourceName] = {
            sourceName,
            displayName:
                translated.displayName,
            status:
                translated.translationStatus,
            level3: {}
        };
    }

    return category.subcategories[sourceName];
}

function ensureLevel3(
    subcategory,
    sourceName
) {
    if (!sourceName) {
        return null;
    }

    if (
        !subcategory.level3[sourceName]
    ) {
        subcategory.level3[sourceName] = {
            sourceName,
            displayName: sourceName,
            status: 'pending'
        };
    }

    return subcategory.level3[sourceName];
}

async function readFeed(
    csvFile,
    callback
) {
    const stream = fs.createReadStream(
        csvFile.fullPath,
        {
            encoding: 'utf8'
        }
    );

    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    let headers = null;
    let buffer = '';

    for await (const line of rl) {
        buffer = buffer
            ? `${buffer}\n${line}`
            : line;

        if (!isCompleteCsvRecord(buffer)) {
            continue;
        }

        const record = buffer;
        buffer = '';

        if (!headers) {
            headers =
                parseCsvRecord(record);

            headers[0] =
                headers[0].replace(
                    /^\uFEFF/,
                    ''
                );

            continue;
        }

        const values =
            parseCsvRecord(record);

        const row = {};

        headers.forEach(
            (header, index) => {
                row[header] =
                    values[index] ?? '';
            }
        );

        await callback(row);
    }

    rl.close();
    stream.destroy();
}

function countRegistry(registry) {
    let categories = 0;
    let subcategories = 0;
    let level3 = 0;

    let pendingCategories = 0;
    let pendingSubcategories = 0;
    let pendingLevel3 = 0;

    for (
        const category
        of Object.values(
            registry.categories
        )
    ) {
        categories++;

        if (
            category.status ===
            'pending'
        ) {
            pendingCategories++;
        }

        for (
            const subcategory
            of Object.values(
                category.subcategories
            )
        ) {
            subcategories++;

            if (
                subcategory.status ===
                'pending'
            ) {
                pendingSubcategories++;
            }

            for (
                const item
                of Object.values(
                    subcategory.level3
                )
            ) {
                level3++;

                if (
                    item.status ===
                    'pending'
                ) {
                    pendingLevel3++;
                }
            }
        }
    }

    return {
        categories,
        subcategories,
        level3,
        pendingCategories,
        pendingSubcategories,
        pendingLevel3
    };
}

async function buildRegistry() {
    const csvFile =
        getLatestCsvFile();

    const registry =
        loadExistingRegistry();

    console.log(
        '========================================'
    );
    console.log(
        'SHOPEE CATEGORY REGISTRY'
    );
    console.log(
        '========================================'
    );

    console.log(
        `CSV: ${csvFile.name}`
    );

    console.log(
        `Tamanho: ${(csvFile.size / 1024 / 1024).toFixed(2)} MB`
    );

    console.log('');
    console.log(
        'Lendo catálogo e atualizando registro...'
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

            if (!categorySource) {
                return;
            }

            const category =
                ensureCategory(
                    registry,
                    categorySource
                );

            if (!subcategorySource) {
                return;
            }

            const subcategory =
                ensureSubcategory(
                    category,
                    subcategorySource
                );

            if (!level3Source) {
                return;
            }

            ensureLevel3(
                subcategory,
                level3Source
            );
        }
    );

    registry.updatedAt =
        new Date().toISOString();

    registry.sourceFile =
        csvFile.name;

    fs.mkdirSync(
        path.dirname(REGISTRY_FILE),
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        REGISTRY_FILE,
        JSON.stringify(
            registry,
            null,
            2
        ),
        'utf8'
    );

    const stats =
        countRegistry(registry);

    console.log(
        '========================================'
    );
    console.log(
        'REGISTRY ATUALIZADO'
    );
    console.log(
        '========================================'
    );

    console.log(
        `Arquivo: ${REGISTRY_FILE}`
    );

    console.log('');
    console.log(
        `Categorias: ${stats.categories}`
    );

    console.log(
        `Subcategorias: ${stats.subcategories}`
    );

    console.log(
        `Nível 3: ${stats.level3}`
    );

    console.log('');

    console.log(
        `Categorias pendentes: ${stats.pendingCategories}`
    );

    console.log(
        `Subcategorias pendentes: ${stats.pendingSubcategories}`
    );

    console.log(
        `Nível 3 pendente: ${stats.pendingLevel3}`
    );
}

buildRegistry().catch(error => {
    console.error('');
    console.error('ERRO:');
    console.error(
        error.message
    );
    process.exitCode = 1;
});
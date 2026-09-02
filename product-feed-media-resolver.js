'use strict';

const {
    getLatestCsvFile,
    readFeed
} = require('./feed-test');


function normalizeText(value) {
    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const text =
        String(value).trim();

    return text || null;
}


function normalizeId(value) {
    return normalizeText(value);
}


function uniqueStrings(values) {
    const result = [];

    for (const value of values) {
        const text =
            normalizeText(value);

        if (
            text &&
            !result.includes(text)
        ) {
            result.push(text);
        }
    }

    return result;
}


async function findProductMediaInFeed(
    itemId,
    options = {}
) {
    const normalizedItemId =
        normalizeId(itemId);

    if (!normalizedItemId) {
        throw new Error(
            'itemId não informado.'
        );
    }

    const csvFile =
        options.csvFile ||
        getLatestCsvFile();

    let found =
        null;

    console.log(
        `Procurando mídia do item ${normalizedItemId} no Data Feed...`
    );

    await readFeed(
        csvFile,
        row => {
            const rowItemId =
                normalizeId(
                    row.itemid
                );

            if (
                rowItemId !==
                normalizedItemId
            ) {
                return false;
            }

            const images =
                uniqueStrings([
                    row.image_link,
                    row.image_link_3
                ]);

            found = {
                itemId:
                    rowItemId,

                images,

                video:
                    null,

                videos: [],

                sourceFile:
                    csvFile.name,

                rawMedia: {
                    image_link:
                        normalizeText(
                            row.image_link
                        ),

                    image_link_3:
                        normalizeText(
                            row.image_link_3
                        )
                }
            };

            /*
             * readFeed interrompe a leitura quando
             * o callback retorna true.
             */
            return true;
        }
    );

    if (!found) {
        return {
            itemId:
                normalizedItemId,

            images: [],

            video:
                null,

            videos: [],

            sourceFile:
                csvFile.name,

            rawMedia: {
                image_link:
                    null,

                image_link_3:
                    null
            }
        };
    }

    return found;
}


async function main() {
    const itemId =
        process.argv[2];

    if (!itemId) {
        console.log('');
        console.log(
            'Uso:'
        );
        console.log(
            'node product-feed-media-resolver.js ITEM_ID'
        );
        console.log('');
        process.exitCode = 1;
        return;
    }

    try {
        const result =
            await findProductMediaInFeed(
                itemId
            );

        console.log('');
        console.log(
            '========================================'
        );
        console.log(
            'MÍDIA ENCONTRADA NO DATA FEED'
        );
        console.log(
            '========================================'
        );

        console.dir(
            result,
            {
                depth: null,
                colors: true
            }
        );

        console.log('');
    } catch (error) {
        console.error('');
        console.error(
            error?.message ||
            error
        );
        process.exitCode = 1;
    }
}


module.exports = {
    findProductMediaInFeed
};


if (
    require.main === module
) {
    main();
}

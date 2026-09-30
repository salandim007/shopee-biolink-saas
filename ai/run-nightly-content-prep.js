'use strict';

const scoreStore =
    require('./product-score-store');

const queueStore =
    require('./content-queue-store');

const orchestrator =
    require('./content-orchestrator');

const products =
    require('../product-media-service');


const CHANNELS = [
    'facebook',
    'instagram'
];


function alreadyPrepared(
    itemId,
    channel
) {
    return queueStore
        .readQueue()
        .some(
            item =>
                String(item.itemId) ===
                    String(itemId) &&
                item.channel === channel &&
                (
                    item.status ===
                        'READY_FOR_APPROVAL' ||
                    item.status ===
                        'APPROVED'
                )
        );
}


async function processLevel(level) {
    const items =
        scoreStore
            .readAll()
            .filter(
                item =>
                    item.score?.level ===
                    level
            );

    console.log(
        `=== ${level}: ${items.length} produtos ===`
    );

    for (
        let index = 0;
        index < items.length;
        index += 1
    ) {
        const item =
            items[index];

        console.log(
            `[${level}] ${index + 1}/${items.length} - ${item.itemId}`
        );

        for (const channel of CHANNELS) {
            if (
                alreadyPrepared(
                    item.itemId,
                    channel
                )
            ) {
                console.log(
                    `  ${channel}: ja preparado`
                );

                continue;
            }

            console.log(
                `  ${channel}: preparando...`
            );

            try {
                await orchestrator
                    .prepareContent(
                        item.itemId,
                        {
                            shopId:
                                item.shopId ||
                                undefined,

                            channel
                        }
                    );

                console.log(
                    `  ${channel}: OK`
                );
            } catch (error) {
                console.error(
                    `  ${channel}: ERRO - ${error.message}`
                );
            }
        }
    }
}


async function main() {
    console.log(
        'Iniciando preparacao noturna.'
    );

    /*
     * Primeiro ALTA.
     * Quando terminar, começa MEDIA.
     */
    await processLevel('HIGH');

    console.log(
        'Alta concluida. Iniciando Media.'
    );

    await processLevel('MEDIUM');

    console.log(
        'Preparacao noturna concluida.'
    );
}


main()
    .catch(error => {
        console.error(
            'ERRO FATAL:',
            error
        );

        process.exitCode = 1;
    })
    .finally(() => {
        products.close();
    });

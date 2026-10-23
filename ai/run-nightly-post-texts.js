'use strict';

const products =
    require('../product-media-service');


const {
    fetchProductOfferByItemId
} = require('../shopee-product-url');

const queueStore =
    require('./content-queue-store');

const productProcessingStateStore =
    require('./product-processing-state-store');

const {
    generatePostText
} = require('./post-text-generator');


const PAGE_SIZE =
    100;

const BLOCK_SIZE =
    Math.max(
        1,
        Number(
            process.env.TEXT_BLOCK_SIZE ||
            20
        )
    );

const MAX_PRODUCTS =
    Math.max(
        1,
        Number(
            process.env.TEXT_MAX_PRODUCTS ||
            500
        )
    );


const STOP_AT =
    String(
        process.env.TEXT_STOP_AT ||
        ''
    ).trim();


const TIME_ZONE =
    String(
        process.env.TEXT_TIME_ZONE ||
        'America/Sao_Paulo'
    ).trim();


function parseStopMinutes(value) {
    const match =
        String(value || '')
            .match(
                /^([01]\d|2[0-3]):([0-5]\d)$/
            );

    if (!match) {
        return null;
    }

    return (
        Number(match[1]) * 60 +
        Number(match[2])
    );
}


const STOP_MINUTES =
    parseStopMinutes(
        STOP_AT
    );


function currentLocalMinutes() {
    const parts =
        new Intl.DateTimeFormat(
            'en-GB',
            {
                timeZone:
                    TIME_ZONE,

                hour:
                    '2-digit',

                minute:
                    '2-digit',

                hourCycle:
                    'h23'
            }
        )
            .formatToParts(
                new Date()
            );

    const hour =
        Number(
            parts.find(
                item =>
                    item.type === 'hour'
            )?.value
        );

    const minute =
        Number(
            parts.find(
                item =>
                    item.type === 'minute'
            )?.value
        );

    return (
        hour * 60 +
        minute
    );
}


function reachedStopTime() {
    if (
        STOP_MINUTES === null
    ) {
        return false;
    }

    return (
        currentLocalMinutes() >=
        STOP_MINUTES
    );
}



function alreadyGenerated(
    itemId,
    channel
) {
    return queueStore
        .readQueue()
        .some(item => {
            if (
                String(item.itemId) !==
                    String(itemId) ||
                item.channel !== channel
            ) {
                return false;
            }

            if (
                ![
                    'READY_FOR_APPROVAL',
                    'APPROVED',
                    'PUBLISHED'
                ].includes(item.status)
            ) {
                return false;
            }

            return (
                item.content?.source ===
                    'single-pass-controlled-copy'
            );
        });
}


/* MIX_PAUSA_COOPERATIVA_V1: somente entre produtos, apos persistencia. */
const _mixFs = require('fs');
const _mixPath = require('path');
const _mixPauseDir = _mixPath.join(__dirname, '..', 'data', 'ai', 'video-coordinator');
async function _mixAguardarVezDoVideo() {
    const requestFile = _mixPath.join(_mixPauseDir, 'solicitacao.json');
    const ackFile = _mixPath.join(_mixPauseDir, 'pausa-confirmada.json');
    let announced = null;
    while (true) {
        let req;
        try {
            req = JSON.parse(_mixFs.readFileSync(requestFile, 'utf8'));
        } catch (e) {
            if (e.code !== 'ENOENT') console.warn('[MIX] Solicitacao invalida; liberando catalogo:', e.message);
            return;
        }
        if (!req || !/^[a-f0-9-]{36}$/.test(String(req.id || '')) ||
            !Number.isFinite(req.expira_ms) || Date.now() > req.expira_ms) {
            console.warn('[MIX] Pedido ausente/expirado; catalogo liberado.');
            return;
        }
        if (announced !== req.id) {
            _mixFs.mkdirSync(_mixPauseDir, {recursive:true});
            const tmp = ackFile + '.' + process.pid + '.tmp';
            _mixFs.writeFileSync(tmp, JSON.stringify({id:req.id, pid:process.pid, em:new Date().toISOString()}));
            _mixFs.renameSync(tmp, ackFile);
            console.log('[MIX] Catálogo pausado entre produtos. Pedido', req.id);
            announced = req.id;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function processOne(summary) {
    const itemId =
        String(summary.itemId);

    const shopId =
        summary.shopId ||
        undefined;

    const product =
        await products
            .getProductByItemId(
                itemId,
                { shopId }
            );

    if (!product) {
        throw new Error(
            'Produto não encontrado no catálogo atual.'
        );
    }


    /*
     * Link afiliado oficial da Shopee.
     * Não é enviado à IA.
     * Apenas entra na publicação final.
     */
    try {
        const offer =
            await fetchProductOfferByItemId(
                product.itemId
            );

        const affiliateLink =
            offer?.product?.offerLink ||
            null;

        if (affiliateLink) {
            product.links = {
                ...(product.links || {}),

                affiliate:
                    affiliateLink,

                short:
                    affiliateLink
            };
        }
    } catch (error) {
        console.warn(
            'LINK:',
            product.itemId,
            '- não foi possível obter offerLink:',
            error.message
        );
    }


    const generated =
        await generatePostText(
            product,
            {
                channel:
                    'facebook'
            }
        );

    const queueItem =
        queueStore
            .createQueueItem({
                itemId,

                channel:
                    'facebook',

                format:
                    'feed',

                status:
                    'APPROVED',

                recommendation: {
                    source:
                        'single-pass-controlled-copy',

                    type:
                        'post-text-only'
                },

                plan:
                    null,

                content:
                    generated
            });

    /*
     * Atualiza a fonte única de estado operacional.
     * A partir daqui a Central já enxerga o produto
     * como PRONTO sem precisar reconstruir a fila.
     */
    productProcessingStateStore.upsert(
        itemId,
        {
            contentReady: true,

            channels: {
                facebook: {
                    queueItemId:
                        queueItem.id,

                    status:
                        queueItem.status,

                    format:
                        queueItem.format,

                    source:
                        'single-pass-controlled-copy',

                    createdAt:
                        queueItem.createdAt,

                    updatedAt:
                        queueItem.updatedAt,

                    approvedAt:
                        queueItem.approvedAt ||
                        queueItem.createdAt,

                    publishedAt:
                        queueItem.publishedAt ||
                        null
                }
            },

            lastProcessedAt:
                queueItem.updatedAt ||
                queueItem.createdAt
        }
    );


    return {
        product,
        generated,
        queueItem
    };
}


async function main() {
    console.log(
        '=== WORKER NOTURNO DE TEXTOS ==='
    );

    console.log(
        'Bloco:',
        BLOCK_SIZE
    );

    console.log(
        'Máximo de segurança:',
        MAX_PRODUCTS
    );

    console.log(
        'Parada automática:',
        STOP_AT || 'desativada',
        '-',
        TIME_ZONE
    );

    let offset = 0;
    let attemptedCount = 0;
    let generatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let blockCount = 0;

    while (
        attemptedCount <
            MAX_PRODUCTS &&
        !reachedStopTime()
    ) {
        const page =
            await products.listProducts({
                limit:
                    PAGE_SIZE,

                offset
            });

        if (
            !page.products ||
            page.products.length === 0
        ) {
            break;
        }

        for (
            const summary
            of page.products
        ) {
            await _mixAguardarVezDoVideo();
            if (
                reachedStopTime()
            ) {
                console.log('');
                console.log(
                    `Horário limite ${STOP_AT} atingido.`
                );
                console.log(
                    'Nenhum novo produto será iniciado.'
                );
                break;
            }

            if (
                attemptedCount >=
                MAX_PRODUCTS
            ) {
                break;
            }

            if (
                alreadyGenerated(
                    summary.itemId,
                    'facebook'
                )
            ) {
                skippedCount += 1;
                continue;
            }

            attemptedCount += 1;

            if (
                (attemptedCount - 1) %
                    BLOCK_SIZE ===
                0
            ) {
                blockCount += 1;

                console.log(
                    ''
                );

                console.log(
                    `=== BLOCO ${blockCount} ===`
                );
            }

            console.log(
                `Processando ${summary.itemId} - ${summary.title}`
            );

            try {
                const result =
                    await processOne(
                        summary
                    );

                generatedCount += 1;

                console.log(
                    'OK:',
                    result.queueItem.id
                );

                console.log(
                    result.generated
                        .content
                        .body
                );

            } catch (error) {
                failedCount += 1;

                console.error(
                    'ERRO:',
                    summary.itemId,
                    '-',
                    error.message
                );

                if (error.rawAIResponse) {
                    console.error(
                        '--- RESPOSTA BRUTA DA IA ---'
                    );

                    console.error(
                        error.rawAIResponse
                    );

                    console.error(
                        '--- FIM DA RESPOSTA ---'
                    );
                }
            }
        }

        offset +=
            page.products.length;

        if (
            page.products.length <
            PAGE_SIZE
        ) {
            break;
        }
    }

    console.log('');
    console.log('=== RESUMO ===');

    console.log(
        'Tentados:',
        attemptedCount
    );

    console.log(
        'Gerados:',
        generatedCount
    );

    console.log(
        'Falhas:',
        failedCount
    );

    console.log(
        'Ignorados já prontos:',
        skippedCount
    );

    console.log(
        'Encerrado pelo horário:',
        reachedStopTime()
            ? 'SIM'
            : 'NÃO'
    );
}


main()
    .catch(error => {
        console.error(
            'ERRO FATAL:',
            error.stack ||
            error.message
        );

        process.exitCode =
            1;
    })
    .finally(() => {
        products.close();
    });

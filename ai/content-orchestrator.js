'use strict';

const products =
    require('../product-media-service');

const analysisStore =
    require('./product-analysis-store');

const {
    deepVerifyRecord
} = require('./product-verifier');

const {
    planContent
} = require('./content-planner');

const {
    generateContent
} = require('./content-generator');

const {
    createQueueItem
} = require('./content-queue-store');


const SUPPORTED_CHANNELS =
    new Set([
        'facebook',
        'instagram',
        'pinterest'
    ]);


function errorMessage(error) {
    return (
        error?.message ||
        'Falha não identificada.'
    );
}


function productTitle(product) {
    return (
        String(
            product?.title ||
            product?.productName ||
            'Produto'
        ).trim() ||
        'Produto'
    );
}


function buildFallbackVerification(
    error
) {
    return {
        status:
            'APPROVED',

        issues: [
            'Verificação por IA indisponível.'
        ],

        suggestedCorrection:
            null,

        fallback: {
            used:
                true,

            stage:
                'verification',

            reason:
                errorMessage(error),

            createdAt:
                new Date().toISOString()
        }
    };
}


function buildFallbackPlan(
    product,
    recommendation,
    error
) {
    const title =
        productTitle(product);

    return {
        itemId:
            String(
                product?.itemId ||
                ''
            ),

        provider:
            'local-fallback',

        model:
            null,

        generatedAt:
            new Date().toISOString(),

        recommendation,

        plan: {
            approachType:
                'fallback-title-only',

            hook:
                title,

            painOrDesire:
                null,

            solution:
                null,

            angle:
                null,

            objective:
                null,

            cta:
                null,

            mediaDirection:
                'Usar a mídia original do produto.',

            warnings: [
                'Fallback local: somente nome do produto.'
            ]
        },

        fallback: {
            used:
                true,

            stage:
                'pipeline',

            mode:
                'TITLE_ONLY',

            reason:
                errorMessage(error),

            createdAt:
                new Date().toISOString()
        }
    };
}


function buildFallbackContent(
    product,
    channel,
    format,
    error
) {
    const title =
        productTitle(product);

    return {
        channel,

        format:
            format || null,

        headline:
            title,

        hook:
            null,

        body:
            title,

        cta:
            null,

        overlayText:
            title,

        hashtags:
            [],

        mediaInstruction:
            'Usar a mídia original do produto.',

        altText:
            title,

        warnings: [
            'Fallback local: somente nome do produto.'
        ],

        fallback: {
            used:
                true,

            stage:
                'pipeline',

            mode:
                'TITLE_ONLY',

            reason:
                errorMessage(error),

            createdAt:
                new Date().toISOString()
        }
    };
}


function buildRecommendation(
    record,
    verification
) {
    if (
        verification?.status ===
        'CORRECTION_SUGGESTED' &&
        verification.suggestedCorrection
    ) {
        return {
            ...record.analysis,
            ...verification.suggestedCorrection,
            correctedByVerifier: true
        };
    }

    return {
        ...record.analysis,
        correctedByVerifier: false
    };
}


async function prepareContent(
    itemId,
    options = {}
) {
    const analysis =
        analysisStore.getByItemId(
            itemId
        );

    if (!analysis) {
        throw new Error(
            `Produto ${itemId} ainda não possui análise da IA.`
        );
    }

    if (
        analysis.status !==
        'VALIDATED' &&
        analysis.status !==
        'NEEDS_REVIEW'
    ) {
        throw new Error(
            `Análise não utilizável: ${analysis.status}`
        );
    }

    const product =
        await products.getProductByItemId(
            itemId,
            {
                shopId:
                    options.shopId || undefined
            }
        );

    if (!product) {
        throw new Error(
            `Produto ${itemId} não encontrado.`
        );
    }

    let verification;
    let pipelineFallbackError = null;

    try {
        verification =
            await deepVerifyRecord(
                analysis,
                product
            );
    } catch (error) {
        console.warn(
            '[content-fallback][verification]',
            itemId,
            errorMessage(error)
        );

        pipelineFallbackError =
            error;

        verification =
            buildFallbackVerification(
                error
            );
    }

    if (
        verification.status ===
        'REJECTED'
    ) {
        return {
            success: false,
            itemId:
                String(itemId),
            stage:
                'verification',
            verification
        };
    }

    const recommendation =
        buildRecommendation(
            analysis,
            verification
        );

    const channel =
        options.channel ||
        recommendation.canal ||
        null;

    if (!channel) {
        throw new Error(
            'Nenhum canal definido para gerar o conteúdo.'
        );
    }

    if (!SUPPORTED_CHANNELS.has(channel)) {
        throw new Error(
            `Canal não suportado: ${channel}`
        );
    }

    const format =
        options.format ||
        recommendation.formato ||
        null;

    let planned;
    let generated;

    /*
     * REGRA DA LINHA DE PRODUÇÃO:
     *
     * Uma estação de IA falhou?
     * Usa TITLE_ONLY e segue.
     *
     * Não tenta as próximas estações
     * de IA para este produto.
     */
    if (pipelineFallbackError) {
        planned =
            buildFallbackPlan(
                product,
                recommendation,
                pipelineFallbackError
            );

        generated =
            buildFallbackContent(
                product,
                channel,
                format,
                pipelineFallbackError
            );

    } else {
        try {
            planned =
                await planContent(
                    product,
                    recommendation
                );

        } catch (error) {
            console.warn(
                '[content-fallback][planning]',
                itemId,
                errorMessage(error)
            );

            pipelineFallbackError =
                error;

            planned =
                buildFallbackPlan(
                    product,
                    recommendation,
                    error
                );

            generated =
                buildFallbackContent(
                    product,
                    channel,
                    format,
                    error
                );
        }


        /*
         * Gerador IA somente se
         * nenhuma estação anterior falhou.
         */
        if (!pipelineFallbackError) {
            try {
                generated =
                    await generateContent({
                        product,
                        plan:
                            planned.plan,
                        channel,
                        format
                    });

            } catch (error) {
                console.warn(
                    '[content-fallback][generation]',
                    itemId,
                    errorMessage(error)
                );

                pipelineFallbackError =
                    error;

                generated =
                    buildFallbackContent(
                        product,
                        channel,
                        format,
                        error
                    );
            }
        }
    }


    const queueItem =
        createQueueItem({
            itemId:
                String(itemId),

            channel,

            format,

            status:
                'READY_FOR_APPROVAL',

            recommendation: {
                original:
                    analysis.analysis,

                verification,

                final:
                    recommendation
            },

            plan:
                planned,

            content:
                generated
        });

    return {
        success: true,
        itemId:
            String(itemId),

        verification,

        recommendation,

        plan:
            planned,

        content:
            generated,

        queueItem
    };
}


module.exports = {
    buildRecommendation,
    prepareContent
};

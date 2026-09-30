'use strict';

/*
 * ============================================================
 * SHOPEE_AI_PIPELINE - PROCESSAMENTO INDIVIDUAL SOB DEMANDA
 * ============================================================
 *
 * Uso:
 * produto novo ou sem material pronto durante o dia.
 *
 * Regra:
 * - processa SOMENTE um produto;
 * - nunca inicia lote geral;
 * - reaproveita análise existente;
 * - se não houver análise, analisa somente este produto;
 * - salva a análise;
 * - prepara somente o canal solicitado;
 * - salva conteúdo em READY_FOR_APPROVAL;
 * - em qualquer erro, marca FAILED e encerra.
 *
 * O score incremental será conectado após a migração definitiva
 * do benchmark do piloto de 100 produtos.
 * ============================================================
 */

const products =
    require('../product-media-service');

const analysisStore =
    require('./product-analysis-store');

const {
    analyzeProduct
} = require('./product-agent');

const orchestrator =
    require('./content-orchestrator');

const jobs =
    require('./content-job-store');


function priorityToLegacy(value) {
    const normalized =
        String(value || '')
            .toLowerCase();

    if (normalized === 'high') {
        return 'alta';
    }

    if (normalized === 'medium') {
        return 'media';
    }

    return 'baixa';
}


function buildLegacyRecord(
    product,
    result
) {
    const recommendation =
        result.recommendation || {};

    return {
        itemId:
            String(product.itemId),

        shopId:
            product.shopId
                ? String(product.shopId)
                : null,

        title:
            product.title || null,

        status:
            'VALIDATED',

        startedAt:
            null,

        finishedAt:
            result.analyzedAt ||
            new Date().toISOString(),

        provider:
            result.provider || null,

        model:
            result.model || null,

        analysis: {
            promover:
                recommendation.decision ===
                'PROMOTE',

            prioridade:
                priorityToLegacy(
                    recommendation.priority
                ),

            canal:
                recommendation.channel ||
                null,

            formato:
                recommendation.format ||
                null,

            motivo:
                recommendation.reason ||
                'Análise individual concluída.'
        },

        validation: {
            valid: true,
            errors: []
        },

        agentResult:
            result
    };
}


async function ensureAnalysis(
    product
) {
    const existing =
        analysisStore.getByItemId(
            product.itemId
        );

    if (
        existing &&
        (
            existing.status === 'VALIDATED' ||
            existing.status === 'NEEDS_REVIEW'
        )
    ) {
        return {
            record: existing,
            reused: true
        };
    }

    const result =
        await analyzeProduct(
            product
        );

    const record =
        buildLegacyRecord(
            product,
            result
        );

    analysisStore.appendRecord(
        record
    );

    return {
        record,
        reused: false
    };
}


async function processJob(job) {
    try {
        jobs.updateJob(
            job.id,
            {
                status: 'PROCESSING',
                progress:
                    'Validando produto',
                startedAt:
                    new Date().toISOString(),
                error: null
            }
        );

        const product =
            await products.getProductByItemId(
                job.itemId,
                {
                    shopId:
                        job.shopId ||
                        undefined
                }
            );

        if (!product) {
            throw new Error(
                `Produto ${job.itemId} não encontrado no catálogo atual.`
            );
        }

        jobs.updateJob(
            job.id,
            {
                progress:
                    'Verificando análise do produto'
            }
        );

        const analysis =
            await ensureAnalysis(
                product
            );

        jobs.updateJob(
            job.id,
            {
                progress:
                    analysis.reused
                        ? 'Análise encontrada. Preparando conteúdo'
                        : 'Análise concluída. Preparando conteúdo'
            }
        );

        const result =
            await orchestrator.prepareContent(
                job.itemId,
                {
                    shopId:
                        job.shopId ||
                        undefined,

                    channel:
                        job.channel,

                    format:
                        job.format ||
                        undefined
                }
            );

        if (
            !result?.success ||
            !result?.queueItem
        ) {
            throw new Error(
                'O conteúdo não foi criado.'
            );
        }

        jobs.updateJob(
            job.id,
            {
                status: 'DONE',
                progress:
                    'Conteúdo pronto para revisão',
                queueItemId:
                    result.queueItem.id,
                finishedAt:
                    new Date().toISOString()
            }
        );

        return {
            success: true,
            jobId: job.id,
            queueItem:
                result.queueItem
        };

    } catch (error) {
        jobs.updateJob(
            job.id,
            {
                status: 'FAILED',
                progress:
                    'Falha no processamento',
                error:
                    error.message,
                finishedAt:
                    new Date().toISOString()
            }
        );

        console.error(
            '[on-demand-product-pipeline]',
            job.itemId,
            job.channel,
            error.message
        );

        return {
            success: false,
            jobId: job.id,
            error:
                error.message
        };
    }
}


module.exports = {
    ensureAnalysis,
    processJob
};

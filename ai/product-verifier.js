'use strict';

const {
    generateAI
} = require('./ai-service');


const VALID_PRIORITIES =
    new Set([
        'baixa',
        'media',
        'alta'
    ]);

const VALID_CHANNELS =
    new Set([
        'instagram',
        'facebook',
        'pinterest',
        null
    ]);

const VALID_FORMATS =
    new Set([
        'feed',
        'story',
        'reel',
        'carousel',
        null
    ]);


function verifyRecord(record, product = null) {
    const issues = [];

    const analysis =
        record?.analysis || {};

    if (
        typeof analysis.promover !==
        'boolean'
    ) {
        issues.push(
            'decisão inválida'
        );
    }

    if (
        !VALID_PRIORITIES.has(
            analysis.prioridade
        )
    ) {
        issues.push(
            'prioridade inválida'
        );
    }

    if (
        !VALID_CHANNELS.has(
            analysis.canal ?? null
        )
    ) {
        issues.push(
            'canal inválido'
        );
    }

    if (
        !VALID_FORMATS.has(
            analysis.formato ?? null
        )
    ) {
        issues.push(
            'formato inválido'
        );
    }

    if (
        analysis.promover === false &&
        analysis.prioridade === 'alta'
    ) {
        issues.push(
            'decisão e prioridade conflitantes'
        );
    }

    if (
        analysis.formato === 'reel' &&
        product &&
        Number(
            product.media?.videoCount || 0
        ) === 0
    ) {
        issues.push(
            'reel sem vídeo disponível'
        );
    }

    return {
        valid:
            issues.length === 0,

        needsDeepReview:
            issues.length > 0,

        issues
    };
}


function parseVerifierJson(content) {
    return JSON.parse(
        String(content || '')
            .replace(/^```json\s*/i, '')
            .replace(/\s*```$/, '')
            .trim()
    );
}


async function deepVerifyRecord(
    record,
    product
) {
    const firstCheck =
        verifyRecord(
            record,
            product
        );

    if (!firstCheck.needsDeepReview) {
        return {
            status: 'APPROVED',
            source: 'rules',
            issues: [],
            suggestedCorrection: null
        };
    }

    const facts = {
        title:
            product?.title || null,

        price:
            product?.offer?.currentPrice ?? null,

        sales:
            product?.commercial?.sales ?? null,

        productRating:
            product?.commercial?.rating ??
            product?.ratings?.product ??
            null,

        shopRating:
            product?.shop?.rating ?? null,

        commissionPercent:
            product?.commercial?.commissionPercent ??
            null,

        imageCount:
            product?.media?.imageCount ?? 0,

        videoCount:
            product?.media?.videoCount ?? 0
    };

    const response =
        await generateAI({
            system:
                'Você revisa uma análise de produto. ' +
                'Use somente os dados fornecidos. ' +
                'Não use desconto ou preço anterior. ' +
                'Não invente informações.',

            prompt: `
Produto:
${JSON.stringify(facts)}

Análise original:
${JSON.stringify(record.analysis)}

Problemas encontrados:
${JSON.stringify(firstCheck.issues)}

Responda SOMENTE JSON em uma linha.

Campos:
acao = APPROVE, CORRECT ou REJECT
promover = true, false ou null
prioridade = baixa, media, alta ou null
canal = instagram, facebook, pinterest ou null
formato = feed, story, reel, carousel ou null
motivo = no máximo 8 palavras
            `.trim(),

            format: 'json',

            options: {
                timeoutMs: 20000,
                think: false,
                temperature: 0,
                num_predict: 64
            }
        });

    const review =
        parseVerifierJson(
            response.content
        );

    const allowed =
        new Set([
            'APPROVE',
            'CORRECT',
            'REJECT'
        ]);

    if (!allowed.has(review.acao)) {
        throw new Error(
            'Ação inválida do Agente Verificador.'
        );
    }

    return {
        status:
            review.acao === 'APPROVE'
                ? 'APPROVED'
                : review.acao === 'CORRECT'
                    ? 'CORRECTION_SUGGESTED'
                    : 'REJECTED',

        source: 'ai_verifier',

        issues:
            firstCheck.issues,

        provider:
            response.provider,

        model:
            response.model,

        suggestedCorrection:
            review.acao === 'CORRECT'
                ? {
                    promover:
                        review.promover,

                    prioridade:
                        review.prioridade,

                    canal:
                        review.canal,

                    formato:
                        review.formato,

                    motivo:
                        review.motivo
                }
                : null,

        reason:
            review.motivo || null
    };
}


module.exports = {
    verifyRecord,
    deepVerifyRecord
};

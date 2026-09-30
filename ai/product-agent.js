'use strict';

const {
    generateAI
} = require('./ai-service');


const PRODUCT_ANALYSIS_FORMAT = {
    type: 'object',
    properties: {
        shouldPromote: {
            type: 'boolean'
        },
        priority: {
            type: 'string'
        },
        channel: {
            type: ['string', 'null']
        },
        format: {
            type: ['string', 'null']
        },
        angle: {
            type: ['string', 'null']
        },
        reason: {
            type: 'string'
        },
        positiveSignals: {
            type: 'array',
            items: {
                type: 'string'
            }
        },
        attentionPoints: {
            type: 'array',
            items: {
                type: 'string'
            }
        },
        missingData: {
            type: 'array',
            items: {
                type: 'string'
            }
        },
        bestTime: {
            type: ['string', 'null']
        },
        nextAction: {
            type: 'string'
        }
    },
    required: [
        'shouldPromote',
        'priority',
        'channel',
        'format',
        'angle',
        'reason',
        'positiveSignals',
        'attentionPoints',
        'missingData',
        'bestTime',
        'nextAction'
    ]
};


function cleanJsonContent(content) {
    let text =
        String(content || '').trim();

    text = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    return JSON.parse(text);
}


function buildProductData(product) {
    const commercial =
        product.commercial || {};

    const publications =
        product.publications || {};

    return {
        itemId:
            product.itemId,

        title:
            product.title,

        currentPrice:
            product.offer?.currentPrice ?? null,

        productRating:
            commercial.rating ??
            product.ratings?.product ??
            null,

        shopRating:
            product.shop?.rating ?? null,

        sales:
            commercial.sales ?? null,

        commissionPercent:
            commercial.commissionPercent ?? null,

        estimatedCommission:
            commercial.estimatedCommission ?? null,

        imageCount:
            product.media?.imageCount ?? 0,

        videoCount:
            product.media?.videoCount ?? 0,

        publications:
            publications.total ?? 0
    };
}


async function analyzeProduct(product) {
    const data =
        buildProductData(product);

    const response =
        await generateAI({
            system: [
                'Você é um agente de análise de produtos para marketing de afiliados.',
                'Analise somente os dados fornecidos.',
                'Não use preço original nem percentual de desconto como sinal de oportunidade.',
                'Não invente métricas, horários, tendências ou dados ausentes.',
                'Horário de publicação só pode ser recomendado quando houver dados reais de desempenho.',
                'A decisão final de publicação pertence ao usuário.'
            ].join(' '),

            instructions: [
                'Retorne somente JSON válido.',
                'Avalie potencial comercial e de conteúdo.',
                'Considere vendas, avaliações, comissão, mídias e histórico de publicações.',
                'Escolha no máximo um canal principal e um formato principal.',
                'Se os dados forem insuficientes, deixe a recomendação conservadora.'
            ].join(' '),

            prompt:
                JSON.stringify(data),

            format: PRODUCT_ANALYSIS_FORMAT,

            options: {
                think: false
            }
        });

    const analysis =
        cleanJsonContent(
            response.content
        );

    return {
        status: 'ANALYZED',

        provider:
            response.provider,

        model:
            response.model,

        analyzedAt:
            new Date().toISOString(),

        product:
            data,

        recommendation: {
            decision:
                analysis.shouldPromote === true
                    ? 'PROMOTE'
                    : 'REVIEW',

            priority:
                analysis.priority || 'low',

            channel:
                analysis.channel || null,

            format:
                analysis.format || null,

            angle:
                analysis.angle || null,

            reason:
                analysis.reason || null,

            positiveSignals:
                Array.isArray(analysis.positiveSignals)
                    ? analysis.positiveSignals
                    : [],

            attentionPoints:
                Array.isArray(analysis.attentionPoints)
                    ? analysis.attentionPoints
                    : [],

            missingData:
                Array.isArray(analysis.missingData)
                    ? analysis.missingData
                    : [],

            bestTime:
                analysis.bestTime || null,

            nextAction:
                analysis.nextAction ||
                'Revisar antes de preparar publicação.'
        }
    };
}


module.exports = {
    PRODUCT_ANALYSIS_FORMAT,
    buildProductData,
    analyzeProduct
};

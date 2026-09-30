'use strict';

const {
    generateAI
} = require('./ai-service');


function buildProductFacts(product) {
    return {
        itemId:
            product?.itemId || null,

        title:
            product?.title || null,

        description:
            product?.description || null,

        category1:
            product?.category1 || null,

        category2:
            product?.category2 || null,

        category3:
            product?.category3 || null,

        currentPrice:
            product?.commercial?.price ??
            product?.offer?.currentPrice ??
            product?.price ??
            null,

        sales:
            product?.commercial?.sales ??
            null,

        productRating:
            product?.commercial?.rating ??
            product?.ratings?.product ??
            null,

        shopRating:
            product?.shop?.rating ??
            null,

        commissionPercent:
            product?.commercial?.commissionPercent ??
            null,

        imageCount:
            product?.media?.imageCount ??
            0,

        videoCount:
            product?.media?.videoCount ??
            0
    };
}


function parseJson(content) {
    return JSON.parse(
        String(content || '')
            .replace(/^```json\s*/i, '')
            .replace(/\s*```$/, '')
            .trim()
    );
}


function normalizePlan(value) {
    return {
        approachType:
            value.tipoAbordagem || null,

        hook:
            value.gancho || null,

        painOrDesire:
            value.dorOuDesejo || null,

        solution:
            value.solucao || null,

        benefits:
            Array.isArray(value.beneficios)
                ? value.beneficios
                : [],

        evidence:
            Array.isArray(value.evidencias)
                ? value.evidencias
                : [],

        angle:
            value.angulo || null,

        objective:
            value.objetivo || null,

        cta:
            value.cta || null,

        mediaDirection:
            value.direcaoMidia || null,

        warnings:
            Array.isArray(value.alertas)
                ? value.alertas
                : []
    };
}


async function planContent(
    product,
    recommendation = {}
) {
    const facts =
        buildProductFacts(product);

    const response =
        await generateAI({
            system: `
Você planeja conteúdo de afiliado.

Use somente os dados fornecidos.
Não invente benefícios, resultados,
urgência, experiência pessoal ou escassez.

Se não houver uma dor real,
use desejo, praticidade ou curiosidade.

Seja extremamente conciso.
            `.trim(),

            prompt: `
PRODUTO:
${JSON.stringify(facts)}

RECOMENDAÇÃO:
${JSON.stringify(recommendation)}

Responda SOMENTE um JSON válido e curto:

{
  "gancho":"máximo 12 palavras",
  "dorOuDesejo":"máximo 15 palavras",
  "solucao":"máximo 15 palavras",
  "angulo":"máximo 10 palavras",
  "cta":"máximo 10 palavras"
}
            `.trim(),

            format: 'json',

            options: {
                timeoutMs: 20000,
                think: false,
                temperature: 0.2,
                num_predict: 180
            }
        });

    const parsed =
        parseJson(
            response.content
        );

    return {
        itemId:
            facts.itemId,

        provider:
            response.provider,

        model:
            response.model,

        generatedAt:
            new Date().toISOString(),

        recommendation,

        plan: {
            approachType:
                null,

            hook:
                parsed.gancho || null,

            painOrDesire:
                parsed.dorOuDesejo || null,

            solution:
                parsed.solucao || null,

            benefits:
                [],

            evidence:
                [],

            angle:
                parsed.angulo || null,

            objective:
                null,

            cta:
                parsed.cta || null,

            mediaDirection:
                null,

            warnings:
                []
        }
    };
}

module.exports = {
    buildProductFacts,
    normalizePlan,
    planContent
};

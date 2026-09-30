'use strict';


function numberOrNull(value) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


function percentile(value, values) {
    const clean =
        values
            .map(numberOrNull)
            .filter(value =>
                value !== null
            )
            .sort((a, b) => a - b);

    const target =
        numberOrNull(value);

    if (
        target === null ||
        clean.length === 0
    ) {
        return null;
    }

    const below =
        clean.filter(
            item => item < target
        ).length;

    const equal =
        clean.filter(
            item => item === target
        ).length;

    return (
        below +
        (equal * 0.5)
    ) / clean.length;
}


function extractFacts(product) {
    return {
        sales:
            numberOrNull(
                product?.commercial?.sales
            ),

        commissionPercent:
            numberOrNull(
                product?.commercial
                    ?.commissionPercent
            ),

        productRating:
            numberOrNull(
                product?.commercial?.rating ??
                product?.ratings?.product
            ),

        shopRating:
            numberOrNull(
                product?.shop?.rating ??
                product?.ratings?.shop
            ),

        imageCount:
            numberOrNull(
                product?.media?.imageCount
            ) || 0,

        videoCount:
            numberOrNull(
                product?.media?.videoCount
            ) || 0
    };
}


function buildBenchmarks(products) {
    const facts =
        products.map(extractFacts);

    return {
        sales:
            facts.map(
                item => item.sales
            ),

        commission:
            facts.map(
                item =>
                    item.commissionPercent
            )
    };
}


function scoreRating(
    value,
    maxPoints
) {
    const rating =
        numberOrNull(value);

    if (rating === null) {
        return 0;
    }

    const normalized =
        Math.max(
            0,
            Math.min(
                1,
                rating / 5
            )
        );

    return normalized * maxPoints;
}


function scoreProduct(
    product,
    benchmarks
) {
    const facts =
        extractFacts(product);

    const positiveSignals = [];
    const negativeSignals = [];
    const missingData = [];

    let score = 0;


    /*
     * VENDAS
     * Até 50 pontos.
     */
    const salesPercentile =
        percentile(
            facts.sales,
            benchmarks.sales
        );

    if (salesPercentile === null) {
        missingData.push(
            'Vendas não disponíveis'
        );
    } else {
        score +=
            salesPercentile * 50;

        if (salesPercentile >= 0.75) {
            positiveSignals.push(
                'Vendas entre as mais fortes do lote'
            );
        } else if (
            salesPercentile <= 0.25
        ) {
            negativeSignals.push(
                'Vendas entre as mais baixas do lote'
            );
        }
    }


    /*
     * COMISSÃO
     * Até 30 pontos.
     */
    const commissionPercentile =
        percentile(
            facts.commissionPercent,
            benchmarks.commission
        );

    if (
        commissionPercentile === null
    ) {
        missingData.push(
            'Comissão não disponível'
        );
    } else {
        score +=
            commissionPercentile * 30;

        if (
            commissionPercentile >= 0.75
        ) {
            positiveSignals.push(
                'Comissão acima da maioria dos produtos'
            );
        } else if (
            commissionPercentile <= 0.25
        ) {
            negativeSignals.push(
                'Comissão abaixo da maioria dos produtos'
            );
        }
    }


    /*
     * AVALIAÇÃO DO PRODUTO
     * Até 8 pontos.
     */
    if (
        facts.productRating === null
    ) {
        missingData.push(
            'Avaliação do produto não disponível'
        );
    } else {
        score +=
            scoreRating(
                facts.productRating,
                8
            );

        if (
            facts.productRating >= 4.7
        ) {
            positiveSignals.push(
                `Produto bem avaliado (${facts.productRating})`
            );
        } else if (
            facts.productRating < 4
        ) {
            negativeSignals.push(
                `Avaliação do produto baixa (${facts.productRating})`
            );
        }
    }


    /*
     * AVALIAÇÃO DA LOJA
     * Até 7 pontos.
     */
    if (
        facts.shopRating === null
    ) {
        missingData.push(
            'Avaliação da loja não disponível'
        );
    } else {
        score +=
            scoreRating(
                facts.shopRating,
                7
            );

        if (
            facts.shopRating >= 4.7
        ) {
            positiveSignals.push(
                `Loja bem avaliada (${facts.shopRating})`
            );
        } else if (
            facts.shopRating < 4
        ) {
            negativeSignals.push(
                `Avaliação da loja baixa (${facts.shopRating})`
            );
        }
    }


    /*
     * MÍDIAS
     * Até 5 pontos.
     */
    if (facts.videoCount > 0) {
        score += 5;

        positiveSignals.push(
            'Vídeo disponível para conteúdo'
        );
    } else if (
        facts.imageCount >= 3
    ) {
        score += 4;

        positiveSignals.push(
            'Boa quantidade de imagens disponível'
        );
    } else if (
        facts.imageCount > 0
    ) {
        score += 2;

        negativeSignals.push(
            'Poucas opções de mídia disponíveis'
        );
    } else {
        negativeSignals.push(
            'Nenhuma mídia disponível'
        );
    }


    score =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(score)
            )
        );


    let level =
        'LOW';

    if (score >= 70) {
        level = 'HIGH';
    } else if (score >= 45) {
        level = 'MEDIUM';
    }


    return {
        score,
        level,

        facts,

        positiveSignals,
        negativeSignals,
        missingData,

        advisoryOnly: true
    };
}


module.exports = {
    numberOrNull,
    percentile,
    extractFacts,
    buildBenchmarks,
    scoreProduct
};

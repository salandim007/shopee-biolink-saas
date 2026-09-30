'use strict';

const fs = require('fs');
const path = require('path');

const products =
    require('../product-media-service');

const analysisStore =
    require('./product-analysis-store');

const {
    buildBenchmarks,
    scoreProduct
} = require('./product-score-engine');


const OUTPUT =
    path.join(
        __dirname,
        '..',
        'data',
        'ai',
        'product-scores-100.json'
    );


async function main() {
    fs.mkdirSync(
        path.dirname(OUTPUT),
        {
            recursive: true
        }
    );

    const analyses =
        analysisStore.readAll()
            .slice(0, 100);

    console.log(
        `Analises encontradas: ${analyses.length}`
    );

    const fullProducts = [];

    for (
        let index = 0;
        index < analyses.length;
        index += 1
    ) {
        const record =
            analyses[index];

        console.log(
            `Buscando ${index + 1}/${analyses.length}: ${record.itemId}`
        );

        try {
            const product =
                await products.getProductByItemId(
                    record.itemId,
                    {
                        shopId:
                            record.shopId ||
                            undefined
                    }
                );

            if (product) {
                fullProducts.push({
                    record,
                    product
                });
            }
        } catch (error) {
            console.error(
                `Falha ${record.itemId}:`,
                error.message
            );
        }
    }

    const benchmarks =
        buildBenchmarks(
            fullProducts.map(
                item => item.product
            )
        );

    const results =
        fullProducts.map(
            ({ record, product }) => {
                const score =
                    scoreProduct(
                        product,
                        benchmarks
                    );

                return {
                    itemId:
                        String(record.itemId),

                    shopId:
                        record.shopId || null,

                    title:
                        record.title || product.title,

                    image:
                        product.image ||
                        product.media?.images?.[0] ||
                        null,

                    aiSuggestion: {
                        promote:
                            record.analysis?.promover ??
                            null,

                        priority:
                            record.analysis?.prioridade ??
                            null,

                        channel:
                            record.analysis?.canal ??
                            null,

                        format:
                            record.analysis?.formato ??
                            null,

                        reason:
                            record.analysis?.motivo ??
                            null
                    },

                    score,

                    scoredAt:
                        new Date().toISOString()
                };
            }
        );

    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(
            results,
            null,
            2
        ) + '\n',
        'utf8'
    );

    console.log(
        `Pontuacoes salvas: ${results.length}`
    );

    console.log(
        `Arquivo: ${OUTPUT}`
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

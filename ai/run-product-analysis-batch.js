'use strict';

const fs = require('fs');
const path = require('path');

const products =
    require('../product-media-service');

const {
    generateAI
} = require('./ai-service');

const OUTPUT =
    path.join(
        __dirname,
        '..',
        'data',
        'ai',
        'product-analysis-100.jsonl'
    );

const STATUS =
    path.join(
        __dirname,
        '..',
        'data',
        'ai',
        'product-analysis-100-status.json'
    );


fs.mkdirSync(
    path.dirname(OUTPUT),
    {
        recursive: true
    }
);

function parseJson(text) {
    return JSON.parse(
        String(text || '')
            .replace(/^```json\s*/i, '')
            .replace(/\s*```$/, '')
            .trim()
    );
}

function buildInput(product) {
    const c = product.commercial || {};

    return {
        itemId: product.itemId,
        title: product.title,
        price: product.offer?.currentPrice ?? null,
        sales: c.sales ?? null,
        productRating:
            c.rating ??
            product.ratings?.product ??
            null,
        shopRating:
            product.shop?.rating ?? null,
        commissionPercent:
            c.commissionPercent ?? null,
        estimatedCommission:
            c.estimatedCommission ?? null,
        imageCount:
            product.media?.imageCount ?? 0,
        videoCount:
            product.media?.videoCount ?? 0,
        publications:
            product.publications?.total ?? 0
    };
}


async function analyzeOne(product) {
    const input = buildInput(product);

    const startedAt = Date.now();

    const response = await generateAI({
        system:
            'Você analisa produtos para marketing de afiliados. ' +
            'Use somente os dados fornecidos. ' +
            'Não use desconto ou preço anterior. ' +
            'Não invente informações.',

        prompt: `
Dados:
${JSON.stringify(input)}

Responda SOMENTE JSON em uma linha.

Campos:
promover = true ou false
prioridade = baixa, media ou alta
canal = instagram, facebook, pinterest ou null
formato = feed, story, reel, carousel ou null
motivo = no máximo 8 palavras
        `.trim(),

        format: 'json',

        options: {
            think: false,
            temperature: 0,
            num_predict: 64
        }
    });

    return {
        input,
        raw: response.content,
        parsed: parseJson(response.content),
        provider: response.provider,
        model: response.model,
        durationMs:
            Date.now() - startedAt
    };
}

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


function validateAnalysis(value) {
    const errors = [];

    if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {
        return {
            valid: false,
            errors: [
                'Resposta não é um objeto JSON.'
            ]
        };
    }

    if (
        typeof value.promover !==
        'boolean'
    ) {
        errors.push(
            'promover inválido'
        );
    }

    if (
        !VALID_PRIORITIES.has(
            value.prioridade
        )
    ) {
        errors.push(
            'prioridade inválida'
        );
    }

    if (
        !VALID_CHANNELS.has(
            value.canal ?? null
        )
    ) {
        errors.push(
            'canal inválido'
        );
    }

    if (
        !VALID_FORMATS.has(
            value.formato ?? null
        )
    ) {
        errors.push(
            'formato inválido'
        );
    }

    if (
        typeof value.motivo !== 'string' ||
        !value.motivo.trim()
    ) {
        errors.push(
            'motivo ausente'
        );
    }

    return {
        valid:
            errors.length === 0,

        errors
    };
}


function loadProcessedIds() {
    const ids = new Set();

    if (!fs.existsSync(OUTPUT)) {
        return ids;
    }

    const lines =
        fs.readFileSync(
            OUTPUT,
            'utf8'
        )
        .split('\n')
        .filter(Boolean);

    for (const line of lines) {
        try {
            const record =
                JSON.parse(line);

            if (record.itemId) {
                ids.add(
                    String(record.itemId)
                );
            }
        } catch {
            // Ignora linha incompleta.
        }
    }

    return ids;
}


function appendResult(record) {
    fs.appendFileSync(
        OUTPUT,
        JSON.stringify(record) + '\n'
    );
}


function saveStatus(status) {
    const temp =
        STATUS + '.tmp';

    fs.writeFileSync(
        temp,
        JSON.stringify(
            status,
            null,
            2
        )
    );

    fs.renameSync(
        temp,
        STATUS
    );
}

async function processOne(item) {
    const startedAt =
        new Date().toISOString();

    try {
        const product =
            await products.getProductByItemId(
                item.itemId,
                {
                    shopId:
                        item.shopId
                }
            );

        if (!product) {
            throw new Error(
                'Produto não encontrado.'
            );
        }

        const analysis =
            await analyzeOne(product);

        const validation =
            validateAnalysis(
                analysis.parsed
            );

        return {
            itemId:
                item.itemId,

            shopId:
                item.shopId,

            title:
                item.title,

            status:
                validation.valid
                    ? 'VALIDATED'
                    : 'NEEDS_REVIEW',

            startedAt,

            finishedAt:
                new Date().toISOString(),

            durationMs:
                analysis.durationMs,

            provider:
                analysis.provider,

            model:
                analysis.model,

            analysis:
                analysis.parsed,

            raw:
                analysis.raw,

            validation
        };

    } catch (error) {
        return {
            itemId:
                item.itemId,

            shopId:
                item.shopId,

            title:
                item.title,

            status:
                'FAILED',

            startedAt,

            finishedAt:
                new Date().toISOString(),

            error:
                error.message
        };
    }
}

async function main() {
    const list =
        await products.listProducts({
            limit: 100,
            offset: 0
        });

    const processed =
        loadProcessedIds();

    const queue =
        list.products.filter(
            item =>
                !processed.has(
                    String(item.itemId)
                )
        );

    console.log(
        `Total selecionado: ${list.products.length}`
    );

    console.log(
        `Já processados: ${processed.size}`
    );

    console.log(
        `Restantes: ${queue.length}`
    );

    let completed =
        processed.size;

    for (const item of queue) {
        console.log(
            `Processando ${completed + 1}/100:`,
            item.itemId,
            item.title
        );

        const result =
            await processOne(item);

        appendResult(result);

        completed += 1;

        saveStatus({
            total: 100,
            completed,
            remaining:
                Math.max(
                    0,
                    100 - completed
                ),
            lastItemId:
                item.itemId,
            lastStatus:
                result.status,
            updatedAt:
                new Date().toISOString()
        });

        console.log(
            `Resultado: ${result.status}`
        );
    }

    saveStatus({
        total: 100,
        completed,
        remaining:
            Math.max(
                0,
                100 - completed
            ),
        finished: true,
        updatedAt:
            new Date().toISOString()
    });

    console.log(
        'Batch finalizado.'
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
    .finally(async () => {
        try {
            await products.close();
        } catch {}
    });

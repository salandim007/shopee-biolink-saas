'use strict';


const OLLAMA_BASE_URL =
    String(
        process.env.OLLAMA_BASE_URL ||
        'http://ollama:11434'
    )
        .trim()
        .replace(/\/+$/, '');


const POST_TEXT_MODEL =
    String(
        process.env.POST_TEXT_MODEL ||
        'qwen3.5:4b'
    ).trim();


const HASHTAG_STOPWORDS =
    new Set([
        'para',
        'com',
        'sem',
        'tipo',
        'modelo',
        'universal',
        'unidade',
        'unidades',
        'kit',
        'preto',
        'preta',
        'branco',
        'branca',
        'azul',
        'verde',
        'vermelho',
        'vermelha',
        'novo',
        'nova'
    ]);


function normalizeAscii(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}


function wordCount(value) {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}


function getSource(product) {
    const description =
        String(
            product?.description || ''
        ).trim();

    if (description) {
        return {
            type: 'description',
            text: description
        };
    }

    const title =
        String(
            product?.title || ''
        ).trim();

    if (!title) {
        throw new Error(
            'Produto sem descrição e sem título.'
        );
    }

    return {
        type: 'title',
        text: title
    };
}


function getMonthHashtag(
    date = new Date()
) {
    const month =
        new Intl.DateTimeFormat(
            'pt-BR',
            {
                month: 'long',
                timeZone:
                    'America/Sao_Paulo'
            }
        ).format(date);

    const clean =
        normalizeAscii(month)
            .replace(/[^A-Za-z]/g, '');

    if (!clean) {
        return '';
    }

    return (
        '#' +
        clean.charAt(0).toUpperCase() +
        clean.slice(1).toLowerCase()
    );
}


function buildProductHashtags(title) {
    const words =
        normalizeAscii(
            title
        )
            .match(/[A-Za-z0-9]+/g) ||
        [];

    const selected = [];

    for (const word of words) {
        const lower =
            word.toLowerCase();

        if (
            word.length < 4 ||
            /^\d+$/.test(word) ||
            HASHTAG_STOPWORDS.has(lower)
        ) {
            continue;
        }

        const hashtag =
            '#' +
            word.charAt(0).toUpperCase() +
            word.slice(1);

        if (
            selected.some(
                item =>
                    item.toLowerCase() ===
                    hashtag.toLowerCase()
            )
        ) {
            continue;
        }

        selected.push(hashtag);

        if (selected.length === 3) {
            break;
        }
    }

    const fallback = [
        '#Produto',
        '#Shopee',
        '#ComprasOnline'
    ];

    for (const hashtag of fallback) {
        if (selected.length >= 3) {
            break;
        }

        if (
            !selected.some(
                item =>
                    item.toLowerCase() ===
                    hashtag.toLowerCase()
            )
        ) {
            selected.push(hashtag);
        }
    }

    return selected.slice(0, 3);
}


function getProductLink(product) {
    const candidates = [
        product?.links?.affiliate,
        product?.links?.short,
        product?.affiliateLink,
        product?.offerLink,
        product?.productLink,
        product?.resolvedUrl,
        product?.originalUrl
    ];

    for (const value of candidates) {
        const link =
            String(value || '').trim();

        if (link) {
            return link;
        }
    }

    return '';
}


function cleanHook(value) {
    let hook =
        String(value || '')
            .trim()
            .replace(/^["']|["']$/g, '');

    if (!hook) {
        throw new Error(
            'A IA retornou ação vazia.'
        );
    }

    if (wordCount(hook) > 10) {
        throw new Error(
            'A ação ficou longa demais.'
        );
    }

    hook =
        hook
            .replace(/[.!]+$/, '')
            .trim();

    if (!hook.endsWith('?')) {
        hook += '?';
    }

    return hook;
}


function cleanSolution(value) {
    const solution =
        String(value || '')
            .trim()
            .replace(/^["']|["']$/g, '');

    if (!solution) {
        throw new Error(
            'A IA retornou solução vazia.'
        );
    }

    if (wordCount(solution) > 14) {
        throw new Error(
            'A solução ficou longa demais.'
        );
    }

    return solution;
}


async function callOllama(
    source
) {
    const sourceInstruction =
        source.type === 'description'
            ? [
                'Você recebeu somente a descrição real de um produto.',
                'Trabalhe exclusivamente com essa descrição.'
              ]
            : [
                'Não existe descrição para este produto.',
                'Você recebeu somente o título.',
                'Não deduza benefícios ou características que não estejam escritas no título.'
              ];

    const system =
        [
            ...sourceInstruction,

            'Não use conhecimento externo.',
            'Não invente informações.',

            'Crie somente duas partes para uma publicação curta no Facebook.',

            'HOOK é uma pergunta curta que chama atenção para uma dor, necessidade ou desejo diretamente ligado à função principal do produto.',

            'SOLUTION é uma frase curta mostrando como o produto atende essa necessidade usando somente informações existentes no texto recebido.',

            'Ignore brindes, saudações da loja, cupons, frete, nota fiscal, garantias, pedidos para seguir a loja e informações promocionais secundárias.',

            'Prefira características concretas do produto.',

            'Escreva frases muito curtas, simples e naturais.',
            'Retire palavras desnecessárias.',
            'Não repita o nome completo do produto.',
            'Não use garante, garantindo, assegura ou promessa semelhante.',

            'Evite promessas exageradas, superlativos e alegações que não sejam necessárias.',

            'HOOK deve ter no máximo 10 palavras.',
            'SOLUTION deve ter no máximo 14 palavras.',

            'Escreva em português do Brasil.'
        ].join(' ');


    const response =
        await fetch(
            `${OLLAMA_BASE_URL}/api/generate`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body:
                    JSON.stringify({
                        model:
                            POST_TEXT_MODEL,

                        stream:
                            false,

                        think:
                            false,

                        system,

                        prompt:
                            source.text,

                        format: {
                            type:
                                'object',

                            properties: {
                                hook: {
                                    type:
                                        'string',

                                    maxLength:
                                        75
                                },

                                solution: {
                                    type:
                                        'string',

                                    maxLength:
                                        105
                                }
                            },

                            required: [
                                'hook',
                                'solution'
                            ],

                            additionalProperties:
                                false
                        },

                        options: {
                            temperature:
                                0,

                            num_predict:
                                70
                        }
                    }),

                signal:
                    AbortSignal.timeout(
                        300000
                    )
            }
        );


    if (!response.ok) {
        throw new Error(
            `Ollama respondeu HTTP ${response.status}.`
        );
    }


    const data =
        await response.json();


    let parsed;

    try {
        parsed =
            JSON.parse(
                String(
                    data.response || ''
                )
            );
    } catch (error) {
        const failure =
            new Error(
                'O Ollama retornou JSON inválido.'
            );

        failure.rawAIResponse =
            String(
                data.response || ''
            );

        throw failure;
    }


    return {
        parsed,
        raw:
            String(
                data.response || ''
            )
    };
}


async function generatePostText(
    product,
    options = {}
) {
    const channel =
        options.channel ||
        'facebook';

    const source =
        getSource(product);

    const result =
        await callOllama(
            source
        );

    let hook;
    let solution;

    try {
        hook =
            cleanHook(
                result.parsed.hook
            );

        solution =
            cleanSolution(
                result.parsed.solution
            );

    } catch (error) {
        error.rawAIResponse =
            result.raw;

        throw error;
    }


    const productHashtags =
        buildProductHashtags(
            product?.title || ''
        );

    const monthHashtag =
        getMonthHashtag();

    const hashtags =
        [
            ...productHashtags,
            monthHashtag
        ].filter(Boolean);


    const link =
        getProductLink(
            product
        );


    const cta =
        '🛒 Confira na Shopee 👇';


    const finalText =
        [
            [
                hook,
                solution
            ].join('\n'),

            hashtags.join(' '),

            [
                cta,
                link
            ]
                .filter(Boolean)
                .join('\n')
        ]
            .filter(Boolean)
            .join('\n\n');


    return {
        itemId:
            String(
                product?.itemId || ''
            ),

        channel,

        format:
            'feed',

        provider:
            'ollama',

        model:
            POST_TEXT_MODEL,

        generatedAt:
            new Date()
                .toISOString(),

        source:
            'single-pass-controlled-copy',

        version:
            2,

        sourceType:
            source.type,

        content: {
            headline:
                hook,

            hook,

            solution,

            body:
                finalText,

            hashtags,

            productHashtags,

            monthHashtag,

            cta,

            link,

            overlayText:
                hook,

            warnings:
                []
        }
    };
}


module.exports = {
    getSource,
    getMonthHashtag,
    buildProductHashtags,
    generatePostText
};

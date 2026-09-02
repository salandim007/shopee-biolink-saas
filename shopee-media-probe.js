'use strict';

const fs = require('fs');
const path = require('path');


const DEFAULT_SHOP_ID =
    '1643055311';

const DEFAULT_ITEM_ID =
    '58253146171';


function buildUrl(
    endpoint,
    shopId,
    itemId
) {
    if (
        endpoint ===
        'item-get'
    ) {
        return (
            'https://shopee.com.br/api/v4/item/get' +
            `?itemid=${encodeURIComponent(itemId)}` +
            `&shopid=${encodeURIComponent(shopId)}`
        );
    }

    if (
        endpoint ===
        'pdp-get'
    ) {
        return (
            'https://shopee.com.br/api/v4/pdp/get' +
            `?shop_id=${encodeURIComponent(shopId)}` +
            `&item_id=${encodeURIComponent(itemId)}`
        );
    }

    throw new Error(
        `Endpoint não suportado: ${endpoint}`
    );
}


function collectMediaCandidates(
    value,
    pathParts = [],
    result = []
) {
    if (
        value === null ||
        value === undefined
    ) {
        return result;
    }

    if (
        typeof value ===
        'string'
    ) {
        const key =
            pathParts
                .join('.')
                .toLowerCase();

        const looksLikeMediaKey =
            /image|video|media|thumbnail|cover|preview/.test(
                key
            );

        const looksLikeMediaValue =
            /(?:https?:\/\/|\.mp4(?:\?|$)|\.m3u8(?:\?|$)|\/file\/|img\.susercontent\.com|shopeeusercontent\.com)/i.test(
                value
            );

        if (
            looksLikeMediaKey ||
            looksLikeMediaValue
        ) {
            result.push({
                path:
                    pathParts.join('.'),

                value
            });
        }

        return result;
    }

    if (
        typeof value !==
        'object'
    ) {
        return result;
    }

    if (
        Array.isArray(value)
    ) {
        value.forEach(
            (
                item,
                index
            ) => {
                collectMediaCandidates(
                    item,
                    [
                        ...pathParts,
                        String(index)
                    ],
                    result
                );
            }
        );

        return result;
    }

    for (
        const [
            key,
            child
        ]
        of Object.entries(value)
    ) {
        const nextPath = [
            ...pathParts,
            key
        ];

        const lowerKey =
            key.toLowerCase();

        if (
            (
                /image|video|media|thumbnail|cover|preview/.test(
                    lowerKey
                )
            ) &&
            (
                typeof child === 'number' ||
                typeof child === 'boolean'
            )
        ) {
            result.push({
                path:
                    nextPath.join('.'),

                value:
                    child
            });
        }

        collectMediaCandidates(
            child,
            nextPath,
            result
        );
    }

    return result;
}


function uniqueCandidates(
    candidates
) {
    const seen =
        new Set();

    const unique = [];

    for (
        const candidate
        of candidates
    ) {
        const signature =
            `${candidate.path}|${String(candidate.value)}`;

        if (
            seen.has(signature)
        ) {
            continue;
        }

        seen.add(signature);
        unique.push(candidate);
    }

    return unique;
}


async function requestJson(
    url
) {
    const response =
        await fetch(
            url,
            {
                method:
                    'GET',

                redirect:
                    'follow',

                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                        'Chrome/152.0.0.0 Safari/537.36',

                    'Accept':
                        'application/json,text/plain,*/*',

                    'Accept-Language':
                        'pt-BR,pt;q=0.9,en;q=0.8',

                    'Referer':
                        'https://shopee.com.br/'
                }
            }
        );

    const text =
        await response.text();

    let json =
        null;

    try {
        json =
            JSON.parse(text);
    } catch {
        // Mantém json como null.
    }

    return {
        status:
            response.status,

        ok:
            response.ok,

        contentType:
            response.headers.get(
                'content-type'
            ),

        text,

        json
    };
}


async function testEndpoint({
    name,
    url,
    outputDir
}) {
    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        name
    );
    console.log(
        '========================================'
    );
    console.log(
        url
    );

    let result;

    try {
        result =
            await requestJson(
                url
            );
    } catch (error) {
        console.log(
            `ERRO DE REDE: ${error.message || error}`
        );

        return {
            name,
            url,
            networkError:
                error.message ||
                String(error)
        };
    }

    console.log(
        `HTTP: ${result.status}`
    );

    console.log(
        `Content-Type: ${result.contentType || 'não informado'}`
    );

    const safeName =
        name
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                '-'
            )
            .replace(
                /^-|-$/g,
                ''
            );

    if (result.json) {
        const rawFile =
            path.join(
                outputDir,
                `${safeName}.json`
            );

        fs.writeFileSync(
            rawFile,
            JSON.stringify(
                result.json,
                null,
                2
            ),
            'utf8'
        );

        const media =
            uniqueCandidates(
                collectMediaCandidates(
                    result.json
                )
            );

        console.log(
            `Candidatos de mídia encontrados: ${media.length}`
        );

        if (
            media.length > 0
        ) {
            console.dir(
                media,
                {
                    depth:
                        null,

                    colors:
                        true,

                    maxArrayLength:
                        200
                }
            );
        } else {
            console.log(
                'Nenhum campo de mídia foi identificado no JSON.'
            );
        }

        console.log(
            `JSON salvo em: ${rawFile}`
        );

        return {
            name,
            url,
            status:
                result.status,

            media,
            rawFile
        };
    }

    const textFile =
        path.join(
            outputDir,
            `${safeName}.txt`
        );

    fs.writeFileSync(
        textFile,
        result.text,
        'utf8'
    );

    console.log(
        'A resposta não foi JSON.'
    );

    console.log(
        `Resposta salva em: ${textFile}`
    );

    console.log(
        'Primeiros 500 caracteres:'
    );

    console.log(
        result.text.slice(
            0,
            500
        )
    );

    return {
        name,
        url,
        status:
            result.status,

        media: [],

        rawFile:
            textFile
    };
}


async function main() {
    const shopId =
        String(
            process.argv[2] ||
            DEFAULT_SHOP_ID
        ).trim();

    const itemId =
        String(
            process.argv[3] ||
            DEFAULT_ITEM_ID
        ).trim();

    const outputDir =
        path.join(
            __dirname,
            'tmp',
            'shopee-media-probe',
            `${shopId}-${itemId}`
        );

    fs.mkdirSync(
        outputDir,
        {
            recursive:
                true
        }
    );

    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        'SHOPEE MEDIA PROBE'
    );
    console.log(
        '========================================'
    );
    console.log(
        `SHOP ID: ${shopId}`
    );
    console.log(
        `ITEM ID: ${itemId}`
    );
    console.log(
        'Teste isolado. Nenhum arquivo do catálogo será alterado.'
    );

    const endpoints = [
        {
            name:
                'API V4 ITEM GET',

            url:
                buildUrl(
                    'item-get',
                    shopId,
                    itemId
                )
        },

        {
            name:
                'API V4 PDP GET',

            url:
                buildUrl(
                    'pdp-get',
                    shopId,
                    itemId
                )
        }
    ];

    const report = [];

    for (
        const endpoint
        of endpoints
    ) {
        report.push(
            await testEndpoint({
                ...endpoint,
                outputDir
            })
        );
    }

    const reportFile =
        path.join(
            outputDir,
            'report.json'
        );

    fs.writeFileSync(
        reportFile,
        JSON.stringify(
            {
                shopId,
                itemId,
                testedAt:
                    new Date()
                        .toISOString(),
                report
            },
            null,
            2
        ),
        'utf8'
    );

    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        'TESTE CONCLUÍDO'
    );
    console.log(
        '========================================'
    );
    console.log(
        `Relatório: ${reportFile}`
    );
    console.log('');
}


if (
    require.main ===
    module
) {
    main()
        .catch(
            error => {
                console.error('');
                console.error(
                    error?.stack ||
                    error?.message ||
                    error
                );
                process.exitCode = 1;
            }
        );
}

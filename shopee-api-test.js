const crypto = require('crypto');

const ENDPOINT =
    'https://open-api.affiliate.shopee.com.br/graphql';

const APP_ID =
    process.env.SHOPEE_AFFILIATE_APP_ID;

const SECRET =
    process.env.SHOPEE_AFFILIATE_SECRET;

if (!APP_ID) {
    throw new Error(
        'Variável SHOPEE_AFFILIATE_APP_ID não definida.'
    );
}

if (!SECRET) {
    throw new Error(
        'Variável SHOPEE_AFFILIATE_SECRET não definida.'
    );
}

function createSignature(
    appId,
    timestamp,
    payload,
    secret
) {
    return crypto
        .createHash('sha256')
        .update(
            `${appId}${timestamp}${payload}${secret}`,
            'utf8'
        )
        .digest('hex');
}

function getArg(name) {
    const args =
        process.argv.slice(2);

    const index =
        args.indexOf(name);

    if (
        index === -1 ||
        !args[index + 1]
    ) {
        return null;
    }

    return args[index + 1];
}

function hasArg(name) {
    return process.argv
        .slice(2)
        .includes(name);
}

function getPositiveIntegerArg(
    name,
    fallback
) {
    const value =
        getArg(name);

    if (value === null) {
        return fallback;
    }

    if (!/^\d+$/.test(value)) {
        throw new Error(
            `${name} deve ser um número inteiro positivo.`
        );
    }

    const parsed =
        Number(value);

    if (parsed < 1) {
        throw new Error(
            `${name} deve ser maior ou igual a 1.`
        );
    }

    return parsed;
}

function buildQuery() {
    const itemId =
        getArg('--item');

    const keyword =
        getArg('--keyword');

    const schema =
        hasArg('--schema');

    const page =
        getPositiveIntegerArg(
            '--page',
            1
        );

    const limit =
        getPositiveIntegerArg(
            '--limit',
            10
        );

    if (schema) {
        return `
            query {
                __type(name: "Query") {
                    fields {
                        name
                        args {
                            name
                            type {
                                kind
                                name
                                ofType {
                                    kind
                                    name
                                    ofType {
                                        kind
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;
    }

    if (itemId) {
        if (!/^\d+$/.test(itemId)) {
            throw new Error(
                'Item ID inválido. Informe apenas números.'
            );
        }

        return `
            query {
                productOfferV2(
                    itemId: ${itemId}
                    page: ${page}
                    limit: ${limit}
                ) {
                    nodes {
                        itemId
                        productName
                        offerLink
                        price
                        commissionRate
                        imageUrl
                        shopName
                    }
                    pageInfo {
                        scrollId
                        hasNextPage
                    }
                }
            }
        `;
    }

    if (keyword) {
        const safeKeyword =
            keyword
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"');

        return `
            query {
                productOfferV2(
                    keyword: "${safeKeyword}"
                    page: ${page}
                    limit: ${limit}
                ) {
                    nodes {
                        itemId
                        productName
                        offerLink
                        price
                        commissionRate
                        imageUrl
                        shopName
                    }
                    pageInfo {
                        scrollId
                        hasNextPage
                    }
                }
            }
        `;
    }

    throw new Error(
        'Informe --item, --keyword ou --schema.'
    );
}

async function callShopeeApi(query) {
    const bodyObject = {
        query
    };

    const payload =
        JSON.stringify(bodyObject);

    const timestamp =
        Math.floor(
            Date.now() / 1000
        );

    const signature =
        createSignature(
            APP_ID,
            timestamp,
            payload,
            SECRET
        );

    const authorization =
        `SHA256 Credential=${APP_ID}, ` +
        `Timestamp=${timestamp}, ` +
        `Signature=${signature}`;

    console.log(
        '========================================'
    );

    console.log(
        'SHOPEE AFFILIATE OPEN API - TESTE'
    );

    console.log(
        '========================================'
    );

    console.log(
        `Endpoint: ${ENDPOINT}`
    );

    console.log(
        `AppID: ${APP_ID}`
    );

    console.log(
        `Timestamp: ${timestamp}`
    );

    console.log('');

    console.log(
        'Enviando requisição GraphQL...'
    );

    const response =
        await fetch(
            ENDPOINT,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json',

                    Authorization:
                        authorization
                },

                body: payload
            }
        );

    console.log('');

    console.log(
        `HTTP STATUS: ${response.status}`
    );

    const text =
        await response.text();

    let data;

    try {
        data =
            JSON.parse(text);
    } catch {
        console.log('');

        console.log(
            'RESPOSTA NÃO JSON:'
        );

        console.log(text);

        return null;
    }

    console.log('');

    console.log(
        'RESPOSTA SHOPEE:'
    );

    console.dir(
        data,
        {
            depth: null,
            colors: true
        }
    );

    if (data.errors) {
        console.log('');

        console.log(
            'ERROS GRAPHQL DETECTADOS:'
        );

        for (
            const error
            of data.errors
        ) {
            console.log(
                `- ${error.message}`
            );

            if (
                error.extensions
            ) {
                console.log(
                    error.extensions
                );
            }
        }

        return data;
    }

    if (
        data.data?.productOfferV2
    ) {
        const result =
            data.data.productOfferV2;

        console.log('');

        console.log(
            '========================================'
        );

        console.log(
            'RESUMO PRODUCT OFFER V2'
        );

        console.log(
            '========================================'
        );

        console.log(
            `Produtos retornados: ${result.nodes.length}`
        );

        console.log(
            `Tem próxima página: ${result.pageInfo.hasNextPage}`
        );

        console.log(
            `Scroll ID: ${result.pageInfo.scrollId}`
        );

        if (
            result.nodes.length > 0
        ) {
            console.log('');

            console.log(
                'PRODUTOS:'
            );

            for (
                const product
                of result.nodes
            ) {
                console.log('');

                console.log(
                    '----------------------------------------'
                );

                console.log(
                    `Item ID: ${product.itemId}`
                );

                console.log(
                    `Nome: ${product.productName}`
                );

                console.log(
                    `Preço: R$ ${product.price}`
                );

                console.log(
                    `Comissão: ${product.commissionRate}`
                );

                console.log(
                    `Loja: ${product.shopName}`
                );

                console.log(
                    `Imagem: ${product.imageUrl}`
                );

                console.log(
                    `Link afiliado: ${product.offerLink}`
                );
            }
        }
    }

    if (
        data.data?.__type
    ) {
        const fields =
            data.data.__type.fields || [];

        console.log('');

        console.log(
            '========================================'
        );

        console.log(
            'OPERAÇÕES DO SCHEMA'
        );

        console.log(
            '========================================'
        );

        for (
            const field
            of fields
        ) {
            console.log('');

            console.log(
                `OPERAÇÃO: ${field.name}`
            );

            for (
                const arg
                of field.args
            ) {
                console.log(
                    `- ${arg.name}: ` +
                    `${arg.type.name || arg.type.kind}`
                );
            }
        }
    }

    return data;
}

async function main() {
    const query =
        buildQuery();

    await callShopeeApi(
        query
    );
}

main().catch(error => {
    console.error('');

    console.error(
        'ERRO NO TESTE DA API:'
    );

    console.error(
        error.message
    );

    process.exitCode = 1;
});
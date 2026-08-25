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

    const productFields =
        hasArg('--product-fields');

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


    /*
     * ============================================================
     * INTROSPECÇÃO DOS CAMPOS DE ProductOfferV2
     * ============================================================
     */
    if (productFields) {
        return `
            query {
                __type(name: "ProductOfferV2") {
                    name
                    fields {
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
        `;
    }


    /*
     * ============================================================
     * INTROSPECÇÃO DO SCHEMA
     * ============================================================
     */
    if (schema) {
        return `
            query {
                __type(name: "Query") {
                    fields {
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

                                    ofType {
                                        kind
                                        name
                                    }
                                }
                            }
                        }

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


    /*
     * ============================================================
     * CONSULTA POR ITEM ID
     * ============================================================
     */
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
                        productLink
                        price
                        priceMin
                        priceMax
                        priceDiscountRate
                        commissionRate
                        commission
                        sellerCommissionRate
                        shopeeCommissionRate
                        sales
                        ratingStar
                        imageUrl
                        shopName
                        shopId
                        productCatIds
                    }

                    pageInfo {
                        scrollId
                        hasNextPage
                    }
                }
            }
        `;
    }


    /*
     * ============================================================
     * CONSULTA POR PALAVRA-CHAVE
     * ============================================================
     */
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
                        productLink
                        price
                        priceMin
                        priceMax
                        priceDiscountRate
                        commissionRate
                        commission
                        sellerCommissionRate
                        shopeeCommissionRate
                        sales
                        ratingStar
                        imageUrl
                        shopName
                        shopId
                        productCatIds
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
        'Informe --item, --keyword, --schema ou --product-fields.'
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


    /*
     * ============================================================
     * ERROS GRAPHQL
     * ============================================================
     */
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


    /*
     * ============================================================
     * RESULTADO PRODUCT OFFER V2
     * ============================================================
     */
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
                    `Shop ID: ${product.shopId}`
                );

                console.log(
                    `Nome: ${product.productName}`
                );

                console.log(
                    `Preço: R$ ${product.price}`
                );

                console.log(
                    `Preço mínimo: R$ ${product.priceMin}`
                );

                console.log(
                    `Preço máximo: R$ ${product.priceMax}`
                );

                console.log(
                    `Desconto: ${product.priceDiscountRate}%`
                );

                console.log(
                    `Comissão: ${product.commissionRate}`
                );

                console.log(
                    `Comissão estimada: ${product.commission}`
                );

                console.log(
                    `Comissão vendedor: ${product.sellerCommissionRate}`
                );

                console.log(
                    `Comissão Shopee: ${product.shopeeCommissionRate}`
                );

                console.log(
                    `Vendas: ${product.sales}`
                );

                console.log(
                    `Avaliação: ${product.ratingStar}`
                );

                console.log(
                    `Loja: ${product.shopName}`
                );

                console.log(
                    `Categorias IDs: ${
                        Array.isArray(
                            product.productCatIds
                        )
                            ? product.productCatIds.join(' > ')
                            : ''
                    }`
                );

                console.log(
                    `Imagem: ${product.imageUrl}`
                );

                console.log(
                    `Link produto: ${product.productLink}`
                );

                console.log(
                    `Link afiliado: ${product.offerLink}`
                );
            }
        }
    }


    /*
     * ============================================================
     * RESULTADO DA INTROSPECÇÃO
     * ============================================================
     */
    if (
        data.data?.__type
    ) {
        const typeInfo =
            data.data.__type;

        const fields =
            typeInfo.fields || [];


        console.log('');

        console.log(
            '========================================'
        );

        console.log(
            `TIPO GRAPHQL: ${typeInfo.name || '(sem nome)'}`
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
                `CAMPO: ${field.name}`
            );


            const returnType =
                field.type?.name ||
                field.type?.ofType?.name ||
                field.type?.ofType?.ofType?.name ||
                field.type?.ofType?.ofType?.ofType?.name ||
                '(não identificado)';


            console.log(
                `RETORNO: ${returnType}`
            );


            for (
                const arg
                of field.args || []
            ) {
                const argType =
                    arg.type?.name ||
                    arg.type?.ofType?.name ||
                    arg.type?.ofType?.ofType?.name ||
                    arg.type?.kind ||
                    '(não identificado)';


                console.log(
                    `- ${arg.name}: ${argType}`
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
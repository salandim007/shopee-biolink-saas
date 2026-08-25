'use strict';


/*
 * ============================================================
 * VITRINE 2 - PRODUCT AVAILABILITY
 * ============================================================
 *
 * Responsabilidade deste arquivo:
 *
 * - interpretar erros vindos da consulta Shopee;
 * - distinguir "produto não encontrado" de falha temporária;
 * - decidir quando um produto pode ser ocultado com segurança;
 *
 * Este arquivo NÃO consulta a Shopee.
 * Este arquivo NÃO altera o catálogo.
 * Este arquivo NÃO altera a vitrine2.ejs.
 * ============================================================
 */


const AVAILABILITY_STATUS = Object.freeze({
    AVAILABLE:
        'available',

    UNAVAILABLE:
        'unavailable',

    UNKNOWN:
        'unknown'
});


/*
 * ============================================================
 * CLASSIFICAÇÃO DE ERRO
 * ============================================================
 *
 * Hoje, com a query productOfferV2 existente, o único sinal
 * suficientemente seguro de indisponibilidade é:
 *
 * "Nenhum produto encontrado para itemId ..."
 *
 * Demais erros são tratados como UNKNOWN para evitar retirar
 * produtos bons por causa de falha de rede/API/credencial.
 * ============================================================
 */

function classifyShopeeSyncError(
    error
) {
    const message =
        String(
            error?.message ||
            error ||
            ''
        ).trim();

    if (!message) {
        return {
            status:
                AVAILABILITY_STATUS.UNKNOWN,

            shouldUnpublish:
                false,

            reason:
                'Erro sem mensagem.'
        };
    }

    if (
        /^Nenhum produto encontrado para itemId\s+/i.test(
            message
        )
    ) {
        return {
            status:
                AVAILABILITY_STATUS.UNAVAILABLE,

            shouldUnpublish:
                true,

            reason:
                message
        };
    }

    return {
        status:
            AVAILABILITY_STATUS.UNKNOWN,

        shouldUnpublish:
            false,

        reason:
            message
    };
}


/*
 * ============================================================
 * PRODUTO CONSULTADO COM SUCESSO
 * ============================================================
 */

function createAvailableDecision(
    snapshot
) {
    return {
        status:
            AVAILABILITY_STATUS.AVAILABLE,

        shouldUnpublish:
            false,

        itemId:
            snapshot?.itemId ??
            null,

        checkedAt:
            snapshot?.syncedAt ??
            new Date().toISOString(),

        reason:
            'Produto encontrado na Shopee.'
    };
}


/*
 * ============================================================
 * PRODUTO COM ERRO DE CONSULTA
 * ============================================================
 */

function createErrorDecision(
    error
) {
    const classification =
        classifyShopeeSyncError(
            error
        );

    return {
        ...classification,

        checkedAt:
            new Date().toISOString()
    };
}


/*
 * ============================================================
 * TESTE DIRETO PELO TERMINAL
 * ============================================================
 *
 * node vitrine2-product-availability.js
 *
 * O teste é apenas local.
 * Nenhum produto é alterado.
 * ============================================================
 */

function main() {
    const examples = [
        new Error(
            'Nenhum produto encontrado para itemId 123456.'
        ),

        new Error(
            'Shopee API retornou HTTP 500: erro temporário'
        ),

        new Error(
            'Erro GraphQL: Invalid Credential'
        ),

        new Error(
            'Resposta da Shopee não é um JSON válido.'
        )
    ];

    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        'VITRINE 2 - TESTE DE DISPONIBILIDADE'
    );
    console.log(
        '========================================'
    );
    console.log('');

    for (
        const example
        of examples
    ) {
        console.log(
            JSON.stringify(
                {
                    error:
                        example.message,

                    decision:
                        createErrorDecision(
                            example
                        )
                },
                null,
                2
            )
        );

        console.log('');
    }

    console.log(
        'Teste concluído.'
    );
    console.log(
        'Nenhum dado do catálogo foi alterado.'
    );
    console.log('');
}


if (require.main === module) {
    main();
}


module.exports = {
    AVAILABILITY_STATUS,
    classifyShopeeSyncError,
    createAvailableDecision,
    createErrorDecision
};

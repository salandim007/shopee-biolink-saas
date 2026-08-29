'use strict';

const {
    INSTAGRAM_POLICY_VERSION,
    POLICY_STATUS,
    RISK_LEVEL,
    POLICY_SOURCES,
    REGULATED_CATEGORIES,
    INTERNAL_SAFETY_RULES,
    createPolicyDecision
} = require('./policies/instagram-policy');


/*
 * ============================================================
 * INSTAGRAM POLICY VALIDATOR
 * ============================================================
 *
 * Este arquivo APLICA a política do Instagram.
 *
 * IMPORTANTE:
 *
 * Palavras e categorias são DETECTORES.
 * Elas não constituem uma política por si só.
 *
 * Detector encontrou possível categoria sensível:
 *
 *      → NEEDS_REVIEW
 *
 * Nunca:
 *
 *      palavra encontrada → BLOCKED
 *
 * BLOCKED futuramente só poderá ocorrer quando houver
 * enquadramento objetivo em uma regra oficial registrada.
 * ============================================================
 */


function normalizeText(value) {
    return String(
        value || ''
    )
        .normalize('NFD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .toLowerCase()
        .trim();
}


function buildProductText(product = {}) {
    return normalizeText(
        [
            product.title,
            product.description,
            product.category1,
            product.category2,
            product.category3,

            product.metadata
                ?.sourceCategory1,

            product.metadata
                ?.sourceCategory2,

            product.metadata
                ?.sourceCategory3
        ]
            .filter(Boolean)
            .join(' ')
    );
}


/*
 * ============================================================
 * DETECTORES AUXILIARES
 * ============================================================
 *
 * Eles servem apenas para identificar possível enquadramento.
 *
 * Não são "lista oficial de palavras proibidas".
 */

const CATEGORY_DETECTORS =
    Object.freeze({

        firearms: {
            terms: [
                'arma de fogo',
                'revolver',
                'espingarda',
                'rifle de fogo',
                'municao',
                'cartucho de municao',
                'airsoft',
                'arma de brinquedo',
                'pistola de brinquedo'
            ],

            exclusions: [
                'pistola de cola',
                'pistola cola quente',
                'pistola de pintura',
                'pistola pulverizadora',
                'pistola de agua',
                'pistola de espuma'
            ]
        },


        alcohol: {
            terms: [
                'bebida alcoolica',
                'cerveja',
                'vinho alcoolico',
                'whisky',
                'vodka',
                'gin alcoolico',
                'cachaca'
            ],

            exclusions: [
                'sem alcool',
                'zero alcool',
                'alcool gel',
                'alcool isopropilico'
            ]
        },


        tobacco: {
            terms: [
                'cigarro',
                'charuto',
                'tabaco',
                'cigarro eletronico',
                'vape',
                'narguile'
            ],

            exclusions: []
        },


        nonMedicalDrugs: {
            terms: [
                'cocaina',
                'heroina',
                'metanfetamina',
                'crack',
                'droga recreativa'
            ],

            exclusions: []
        },


        pharmaceuticalDrugs: {
            terms: [
                'medicamento',
                'remedio',
                'farmaceutico',
                'farmaceutica'
            ],

            exclusions: [
                'caixa organizadora de remedio',
                'porta remedio',
                'organizador de medicamento'
            ]
        },


        gambling: {
            terms: [
                'cassino',
                'aposta esportiva',
                'jogo de azar',
                'bet online'
            ],

            exclusions: [
                'brinquedo cassino',
                'jogo de tabuleiro'
            ]
        },


        liveAnimals: {
            terms: [
                'animal vivo',
                'animais vivos',
                'filhote para venda'
            ],

            exclusions: [
                'brinquedo animal',
                'pelucia animal',
                'estampa animal'
            ]
        }
    });


function containsAny(
    text,
    terms = []
) {
    return terms.some(
        term =>
            text.includes(
                normalizeText(term)
            )
    );
}


function detectRegulatedCategory(
    product
) {
    const text =
        buildProductText(
            product
        );

    for (
        const [
            categoryId,
            detector
        ]
        of Object.entries(
            CATEGORY_DETECTORS
        )
    ) {
        const hasExcludedContext =
            containsAny(
                text,
                detector.exclusions
            );

        if (hasExcludedContext) {
            continue;
        }

        const detected =
            containsAny(
                text,
                detector.terms
            );

        if (detected) {
            return {
                detected: true,
                categoryId,
                policy:
                    REGULATED_CATEGORIES[
                        categoryId
                    ] || null
            };
        }
    }

    return {
        detected: false,
        categoryId: null,
        policy: null
    };
}


/*
 * ============================================================
 * VALIDAÇÕES BÁSICAS DO CONTEÚDO
 * ============================================================
 */

function validateRequiredProductData(
    product
) {
    if (
        !product ||
        typeof product !== 'object'
    ) {
        return createPolicyDecision({
            status:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.MEDIUM,

            reason:
                'Dados do produto não estão disponíveis para validação.',

            ruleId:
                'internal-missing-product-data',

            source:
                null
        });
    }


    if (!product.title) {
        return createPolicyDecision({
            status:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.MEDIUM,

            reason:
                'Produto sem título suficiente para análise automática.',

            ruleId:
                'internal-missing-title',

            source:
                null
        });
    }


    if (!product.image) {
        return createPolicyDecision({
            status:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.MEDIUM,

            reason:
                'Produto sem imagem disponível para preparação segura do conteúdo.',

            ruleId:
                'internal-missing-image',

            source:
                null
        });
    }

    return null;
}


/*
 * ============================================================
 * VALIDADOR PRINCIPAL
 * ============================================================
 */

function validateInstagramProduct(
    product
) {
    const basicIssue =
        validateRequiredProductData(
            product
        );

    if (basicIssue) {
        return basicIssue;
    }


    const regulated =
        detectRegulatedCategory(
            product
        );

    if (
        regulated.detected &&
        regulated.policy
    ) {
        return createPolicyDecision({
            status:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                regulated.policy
                    .riskLevel ||
                RISK_LEVEL.HIGH,

            reason:
                `Possível enquadramento em categoria sensível do Instagram: ${regulated.categoryId}. Revisão humana necessária antes de publicação.`,

            ruleId:
                regulated.categoryId,

            source:
                regulated.policy
                    .source ||
                POLICY_SOURCES
                    .COMMUNITY_GUIDELINES
        });
    }


    /*
     * Nenhuma violação conhecida foi detectada.
     *
     * Isso NÃO significa que a Meta "aprovou" o produto.
     *
     * Significa:
     *
     * "passou pelas regras oficiais atualmente
     * registradas no nosso Policy Engine".
     */

    return createPolicyDecision({
        status:
            POLICY_STATUS.APPROVED,

        riskLevel:
            RISK_LEVEL.LOW,

        reason:
            'Nenhuma restrição aplicável foi identificada nas regras oficiais do Instagram atualmente registradas no sistema.',

        ruleId:
            'instagram-standard-product',

        source:
            POLICY_SOURCES
                .COMMUNITY_GUIDELINES
    });
}


/*
 * ============================================================
 * RESULTADO PARA O ADMIN
 * ============================================================
 */

function summarizeInstagramDecision(
    decision
) {
    if (!decision) {
        return {
            label:
                'Não validado',

            status:
                null
        };
    }


    const labels = {
        [POLICY_STATUS.APPROVED]:
            'Aprovado automático',

        [POLICY_STATUS.NEEDS_REVIEW]:
            'Revisão necessária',

        [POLICY_STATUS.BLOCKED]:
            'Bloqueado',

        [POLICY_STATUS.REVALIDATE]:
            'Revalidar'
    };


    return {
        label:
            labels[
                decision.status
            ] ||
            decision.status,

        status:
            decision.status,

        riskLevel:
            decision.riskLevel,

        reason:
            decision.reason,

        policyVersion:
            decision.policyVersion,

        checkedAt:
            decision.checkedAt
    };
}


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    CATEGORY_DETECTORS,
    normalizeText,
    buildProductText,
    detectRegulatedCategory,
    validateInstagramProduct,
    summarizeInstagramDecision,
    INSTAGRAM_POLICY_VERSION,
    INTERNAL_SAFETY_RULES
};
'use strict';

/*
 * ============================================================
 * SHOPEE BIOLINK SAAS
 * POLICY PROFILE — INSTAGRAM
 * ============================================================
 *
 * Objetivo:
 *
 * Validar se um produto/conteúdo pode seguir para divulgação
 * no Instagram.
 *
 * Esta política NÃO decide se o produto pode existir na Shopee.
 * A Shopee é a origem do catálogo.
 *
 * Regra fundamental:
 *
 * Nenhuma decisão automática deve ser criada apenas por
 * palavras-chave genéricas.
 *
 * BLOCKED:
 * somente quando existe regra oficial clara aplicável.
 *
 * NEEDS_REVIEW:
 * quando a regra oficial existe, mas o enquadramento do
 * produto/conteúdo é ambíguo.
 *
 * APPROVED:
 * quando não há impedimento identificado nas regras
 * oficiais atualmente registradas.
 *
 * REVALIDATE:
 * quando a política precisa ser conferida novamente.
 * ============================================================
 */


const INSTAGRAM_POLICY_VERSION =
    'instagram-2026-08-28-v1';


const POLICY_STATUS =
    Object.freeze({
        APPROVED: 'approved',
        NEEDS_REVIEW: 'needs_review',
        BLOCKED: 'blocked',
        REVALIDATE: 'revalidate'
    });


const RISK_LEVEL =
    Object.freeze({
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high'
    });


/*
 * ============================================================
 * FONTES OFICIAIS
 * ============================================================
 *
 * Nunca remover a fonte de uma regra automática.
 */

const POLICY_SOURCES =
    Object.freeze({

        BRANDED_CONTENT: {
            id:
                'meta-instagram-branded-content',

            authority:
                'Meta / Instagram',

            title:
                'What is considered branded content',

            url:
                'https://www.facebook.com/help/instagram/616901995832907',

            checkedAt:
                '2026-08-28'
        },


        COMMUNITY_GUIDELINES: {
            id:
                'meta-instagram-community-guidelines',

            authority:
                'Meta / Instagram',

            title:
                'Instagram Community Guidelines',

            url:
                'https://www.facebook.com/help/477434105621119',

            checkedAt:
                '2026-08-28'
        },


        COPYRIGHT: {
            id:
                'meta-instagram-copyright',

            authority:
                'Meta / Instagram',

            title:
                'How to make sure content does not violate copyright law',

            url:
                'https://www.facebook.com/help/354736791367645/',

            checkedAt:
                '2026-08-28'
        },


        MUSIC: {
            id:
                'meta-instagram-music-commercial-use',

            authority:
                'Meta / Instagram',

            title:
                'Access to the licensed music library on Instagram',

            url:
                'https://www.facebook.com/help/instagram/402084904469945',

            checkedAt:
                '2026-08-28'
        }
    });


/*
 * ============================================================
 * REGRAS OFICIAIS DE CONTEÚDO AFILIADO
 * ============================================================
 */

const AFFILIATE_RULES =
    Object.freeze({

        affiliateContentIsCommercialContent: {
            required: true,

            description:
                'Conteúdo com link de afiliado constitui troca de valor e deve seguir as regras de branded content da Meta.',

            source:
                POLICY_SOURCES.BRANDED_CONTENT
        },


        paidPartnershipDisclosure: {
            required: true,

            description:
                'Conteúdo afiliado deve usar a identificação de parceria paga quando exigida pelas ferramentas/políticas aplicáveis do Instagram.',

            source:
                POLICY_SOURCES.BRANDED_CONTENT
        }
    });


/*
 * ============================================================
 * PROPRIEDADE INTELECTUAL
 * ============================================================
 */

const INTELLECTUAL_PROPERTY_RULES =
    Object.freeze({

        requireRightsToMedia: {
            required: true,

            description:
                'Foto, vídeo, áudio e demais materiais usados na publicação precisam ser próprios ou utilizados com autorização/licença válida.',

            source:
                POLICY_SOURCES.COPYRIGHT
        },


        internetAvailabilityIsNotPermission: {
            required: true,

            description:
                'Encontrar conteúdo disponível na internet não significa possuir direito de publicação.',

            source:
                POLICY_SOURCES.COPYRIGHT
        }
    });


/*
 * ============================================================
 * CATEGORIAS / ATIVIDADES REGULADAS
 * ============================================================
 *
 * IMPORTANTE:
 *
 * O detector futuro pode identificar sinais de uma categoria.
 * A categoria abaixo é a POLÍTICA.
 *
 * Palavras-chave serão apenas detectores auxiliares.
 */

const REGULATED_CATEGORIES =
    Object.freeze({

        firearms: {
            id:
                'firearms',

            defaultDecision:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.HIGH,

            description:
                'Instagram possui restrições oficiais relacionadas à compra e venda de armas de fogo.',

            /*
             * Usamos NEEDS_REVIEW como padrão porque um produto
             * pode apenas mencionar uma arma, ser acessório,
             * brinquedo ou ter outro contexto.
             *
             * O validador só poderá retornar BLOCKED quando
             * confirmar que o produto se enquadra na regra.
             */

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        },


        alcohol: {
            id:
                'alcohol',

            defaultDecision:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.HIGH,

            description:
                'A política oficial possui restrições relacionadas à compra e venda de álcool.',

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        },


        tobacco: {
            id:
                'tobacco',

            defaultDecision:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.HIGH,

            description:
                'A política oficial possui restrições relacionadas à compra e venda de produtos de tabaco.',

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        },


        nonMedicalDrugs: {
            id:
                'non_medical_drugs',

            defaultDecision:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.HIGH,

            description:
                'Instagram proíbe comércio, coordenação de comércio e promoção de uso de drogas não médicas conforme suas Community Guidelines.',

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        },


        pharmaceuticalDrugs: {
            id:
                'pharmaceutical_drugs',

            defaultDecision:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.HIGH,

            description:
                'Produtos farmacêuticos aparecem em regras oficiais de bens regulados e exigem análise antes de divulgação automática.',

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        },


        gambling: {
            id:
                'gambling',

            defaultDecision:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.HIGH,

            description:
                'Contas que promovem determinadas modalidades de apostas e jogos com dinheiro real podem exigir permissão prévia da Meta.',

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        },


        liveAnimals: {
            id:
                'live_animals',

            defaultDecision:
                POLICY_STATUS.NEEDS_REVIEW,

            riskLevel:
                RISK_LEVEL.HIGH,

            description:
                'Instagram possui regras específicas relacionadas à venda de animais vivos e espécies ameaçadas.',

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        }
    });


/*
 * ============================================================
 * AUTENTICIDADE / SPAM
 * ============================================================
 */

const DISTRIBUTION_RULES =
    Object.freeze({

        prohibitSpam: {
            required: true,

            description:
                'Não gerar comportamento de spam, comentários repetitivos ou contatos comerciais indesejados.',

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        },


        prohibitArtificialEngagement: {
            required: true,

            description:
                'Não usar técnicas artificiais para obter likes, seguidores, compartilhamentos ou outras interações.',

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        },


        prohibitFakeReviews: {
            required: true,

            description:
                'Não gerar ou promover avaliações falsas ou enganosas.',

            source:
                POLICY_SOURCES.COMMUNITY_GUIDELINES
        }
    });


/*
 * ============================================================
 * MÚSICA / ÁUDIO
 * ============================================================
 */

const MUSIC_RULES =
    Object.freeze({

        commercialMusicRequiresValidRights: {
            required: true,

            description:
                'Conteúdo comercial não deve assumir que toda música da biblioteca licenciada comum pode ser utilizada comercialmente.',

            source:
                POLICY_SOURCES.MUSIC
        },


        preferSoundCollectionForCommercialUse: {
            recommended: true,

            description:
                'Quando o sistema adicionar áudio automaticamente, priorizar áudio aprovado para uso comercial, como recursos da Meta Sound Collection quando aplicável.',

            source:
                POLICY_SOURCES.MUSIC
        }
    });


/*
 * ============================================================
 * REGRAS INTERNAS DE SEGURANÇA
 * ============================================================
 *
 * Estas NÃO são políticas da Meta.
 *
 * São regras do Shopee BioLink SaaS para evitar decisões
 * automáticas quando não temos evidência suficiente.
 */

const INTERNAL_SAFETY_RULES =
    Object.freeze({

        uncertainPolicyDecision:
            POLICY_STATUS.NEEDS_REVIEW,


        sensitiveProductWithoutExactMatch:
            POLICY_STATUS.NEEDS_REVIEW,


        missingOfficialSource:
            POLICY_STATUS.NEEDS_REVIEW,


        ambiguousCategory:
            POLICY_STATUS.NEEDS_REVIEW,


        automaticBlockRequiresOfficialEvidence:
            true,


        automaticApprovalRequiresNoKnownViolation:
            true
    });


/*
 * ============================================================
 * FLUXO ATUAL DO INSTAGRAM
 * ============================================================
 */

const CURRENT_INSTAGRAM_FLOW =
    Object.freeze({

        contentType:
            'affiliate_marketing',

        automaticDraftGeneration:
            true,

        automaticPublishing:
            false,

        currentDestination:
            'biolink_storefront',

        /*
         * Fluxo atual:
         *
         * Instagram
         *     ↓
         * Link da bio
         *     ↓
         * Vitrine
         *     ↓
         * Shopee
         */

        nativeShopeeInstagramIntegration:
            false
    });


/*
 * ============================================================
 * ESTRUTURA DA DECISÃO
 * ============================================================
 *
 * O futuro validador deverá retornar neste formato.
 */

function createPolicyDecision({
    status,
    riskLevel,
    reason,
    ruleId = null,
    source = null
}) {
    return {
        channel:
            'instagram',

        status,

        riskLevel,

        reason,

        ruleId,

        source,

        policyVersion:
            INSTAGRAM_POLICY_VERSION,

        checkedAt:
            new Date().toISOString()
    };
}


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    INSTAGRAM_POLICY_VERSION,

    POLICY_STATUS,

    RISK_LEVEL,

    POLICY_SOURCES,

    AFFILIATE_RULES,

    INTELLECTUAL_PROPERTY_RULES,

    REGULATED_CATEGORIES,

    DISTRIBUTION_RULES,

    MUSIC_RULES,

    INTERNAL_SAFETY_RULES,

    CURRENT_INSTAGRAM_FLOW,

    createPolicyDecision
};
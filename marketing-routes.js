'use strict';

const express =
    require('express');

const {
    captureShopeeMedia
} = require('./shopee-browser-media-capture');

const {
    createMetaPublisher
} = require('./marketing/meta-publisher');

const {
    defaultVitrine2Service
} = require('./vitrine2-service');

const {
    defaultProductEvidenceService
} = require('./product-evidence');

const {
    createInstagramContentCreator
} = require('./marketing/instagram-content-creator');

const {
    createEvidenceAuditor
} = require('./marketing/evidence-auditor');

const router =
    express.Router();

const metaPublisher =
    createMetaPublisher();

const instagramContentCreator =
    createInstagramContentCreator();

const evidenceAuditor =
    createEvidenceAuditor();

const pages = {
    overview: {
        view: 'marketing-overview',
        title: 'Visão Geral'
    },

    instagram: {
        view: 'marketing-instagram',
        title: 'Instagram'
    },

    facebook: {
        view: 'marketing-facebook',
        title: 'Facebook'
    },

    tiktok: {
        view: 'marketing-tiktok',
        title: 'TikTok'
    },

    kwai: {
        view: 'marketing-kwai',
        title: 'Kwai'
    },

    outros: {
        view: 'marketing-outros',
        title: 'Outros canais'
    }
};


router.get(
    '/',
    (req, res) => {
        res.redirect(
            '/admin/vitrine2/marketing/overview'
        );
    }
);


Object.entries(
    pages
).forEach(
    ([
        slug,
        page
    ]) => {
        router.get(
            `/${slug}`,
            (req, res) => {
                res.render(
                    page.view,
                    {
                        activeMarketingPage:
                            slug,

                        marketingPageTitle:
                            page.title
                    }
                );
            }
        );
    }
);


function normalizePolicyStatus(
    value
) {
    return String(
        value || ''
    )
        .trim()
        .toLowerCase();
}


function getSavedInstagramPolicy(
    entry
) {
    return (
        entry
            ?.marketing
            ?.policies
            ?.instagram ||
        null
    );
}


async function prepareInstagram(
    marketplace,
    itemId
) {
    /*
     * ========================================================
     * 1. CONFIRMA PRODUTO E CANAL
     * ========================================================
     */

    let entry =
        defaultVitrine2Service.getProduct(
            marketplace,
            itemId
        );

    if (!entry) {
        const error =
            new Error(
                'Produto não encontrado no catálogo.'
            );

        error.code =
            'PRODUCT_NOT_FOUND';

        throw error;
    }

    if (
        entry
            ?.marketing
            ?.channels
            ?.instagram !==
        true
    ) {
        return {
            status: 'NOT_SELECTED',
            reason:
                'Produto não está selecionado para Instagram na Visão Geral.',
            content: null,
            audit: null,
            policy:
                getSavedInstagramPolicy(
                    entry
                )
        };
    }


    /*
     * ========================================================
     * 2. POLICY GATE — ANTES DE IA / CONTEÚDO
     * ========================================================
     *
     * A política já deve ter sido persistida quando o produto
     * foi marcado para Instagram na Visão Geral.
     *
     * Se por compatibilidade existir um produto antigo sem
     * política salva, fazemos uma única validação aqui.
     */

    let policy =
        getSavedInstagramPolicy(
            entry
        );

    if (!policy) {
        defaultVitrine2Service
            .validateInstagramPolicy(
                marketplace,
                itemId
            );

        entry =
            defaultVitrine2Service
                .getProduct(
                    marketplace,
                    itemId
                );

        policy =
            getSavedInstagramPolicy(
                entry
            );
    }

    const policyStatus =
        normalizePolicyStatus(
            policy?.status ||
            policy?.summary?.status
        );

    if (
        policyStatus !==
        'approved'
    ) {
        const mappedStatus = {
            blocked: 'BLOCKED',
            needs_review: 'NEEDS_REVIEW',
            revalidate: 'REVALIDATE',
            unavailable: 'POLICY_UNAVAILABLE'
        };

        return {
            status:
                mappedStatus[
                    policyStatus
                ] ||
                'POLICY_UNAVAILABLE',

            reason:
                policy?.reason ||
                policy?.summary?.reason ||
                'Produto não está aprovado pela política do Instagram.',

            content: null,
            audit: null,
            policy
        };
    }


    /*
     * ========================================================
     * 3. EVIDÊNCIA DO PRODUTO
     * ========================================================
     */

    /*
     * Evidência rápida para Marketing.
     *
     * O produto já está normalizado no catálogo.
     * Não consultar Affiliate API nem varrer Data Feed
     * durante o clique em Preparar Feed.
     */

    const catalogProduct =
        entry?.product || {};

    const evidence = {
        marketplace:
            catalogProduct.marketplace ||
            marketplace ||
            'shopee',

        itemId:
            String(
                catalogProduct.itemId ||
                itemId
            ),

        commercial: {
            itemId:
                String(
                    catalogProduct.itemId ||
                    itemId
                ),

            productName:
                catalogProduct.title ||
                null,

            title:
                catalogProduct.title ||
                null,

            price:
                catalogProduct.price ??
                null,

            priceMin:
                catalogProduct.minPrice ??
                null,

            priceMax:
                catalogProduct.maxPrice ??
                null,

            priceDiscountRate:
                catalogProduct.priceDiscountRate ??
                null,

            sales:
                catalogProduct.sales ??
                null,

            ratingStar:
                catalogProduct.ratingStar ??
                null
        },

        factual: {
            title:
                catalogProduct.title ||
                null,

            description:
                catalogProduct.description ||
                null,

            globalItemAttributes:
                null,

            globalCategory1:
                catalogProduct.category1 ||
                catalogProduct
                    ?.metadata
                    ?.sourceCategory1 ||
                null,

            globalCategory2:
                catalogProduct.category2 ||
                catalogProduct
                    ?.metadata
                    ?.sourceCategory2 ||
                null,

            globalCategory3:
                catalogProduct.category3 ||
                catalogProduct
                    ?.metadata
                    ?.sourceCategory3 ||
                null
        },

        provenance: {
            commercialSource:
                'product_catalog',

            factualSource:
                'product_catalog',

            matchedBy:
                'catalog_itemId'
        }
    };

    console.log(
        '[MARKETING] Evidência carregada do catálogo',
        {
            itemId:
                evidence.itemId,
            title:
                evidence
                    .commercial
                    .productName
        }
    );


    /*
     * ========================================================
     * 4. CRIAÇÃO DO CONTEÚDO
     * ========================================================
     */

    const content =
        await instagramContentCreator.create(
            evidence
        );


    /*
     * ========================================================
     * 5. AUDITORIA DO CONTEÚDO GERADO
     * ========================================================
     */

    const audit =
        await evidenceAuditor.audit(
            evidence,
            content
        );

    const auditApproved =
        String(
            audit?.status ||
            ''
        )
            .trim()
            .toUpperCase() ===
        'APPROVED';


    /*
     * ========================================================
     * 6. RESULTADO FINAL
     * ========================================================
     */

    return {
        status:
            auditApproved
                ? 'READY'
                : 'NEEDS_REVIEW',

        content,
        audit,
        policy
    };
}


async function prepareChannel(
    channel,
    marketplace,
    itemId
) {
    if (channel === 'instagram') {
        return prepareInstagram(
            marketplace,
            itemId
        );
    }

    return {
        status: 'NOT_READY',
        reason:
            'Creator e Policy próprios do Facebook ainda não estão implementados.'
    };
}


router.post(
    '/media/gallery',
    async (req, res) => {
        const body =
            req.body || {};

        const shopId =
            String(
                body.shopId || ''
            ).trim();

        const itemId =
            String(
                body.itemId || ''
            ).trim();

        if (
            !/^\d+$/.test(shopId) ||
            !/^\d+$/.test(itemId)
        ) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PRODUCT_IDS',
                    message:
                        'shopId e itemId são obrigatórios.'
                }
            });
        }

        try {
            const report =
                await captureShopeeMedia(
                    shopId,
                    itemId
                );

            const images =
                Array.isArray(report?.images)
                    ? [...new Set(
                        report.images
                            .map(value =>
                                String(value || '').trim()
                            )
                            .filter(Boolean)
                    )]
                    : [];

            return res.json({
                success: true,
                shopId,
                itemId,
                images,
                videos:
                    Array.isArray(report?.videos)
                        ? report.videos
                        : [],
                imageCount:
                    images.length
            });
        } catch (error) {
            console.error(
                '[MARKETING MEDIA] Falha ao capturar galeria:',
                error?.message || error
            );

            return res.status(500).json({
                success: false,
                error: {
                    code: 'SHOPEE_MEDIA_CAPTURE_FAILED',
                    message:
                        'Não foi possível carregar a galeria do produto.'
                }
            });
        }
    }
);


router.post(
    '/prepare',
    async (req, res) => {
        const body = req.body || {};
        const itemId = String(
            body.itemId ||
            ''
        ).trim();
        const marketplace = String(
            body.marketplace ||
            'shopee'
        )
            .trim()
            .toLowerCase();
        const channels = body.channels;

        if (!/^\d+$/.test(itemId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_ITEM_ID',
                    message: 'itemId inválido.'
                }
            });
        }

        if (
            !Array.isArray(channels) ||
            channels.length === 0
        ) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CHANNELS_REQUIRED',
                    message: 'Informe pelo menos um canal.'
                }
            });
        }

        const uniqueChannels =
            [
                ...new Set(
                    channels.map(
                        channel =>
                            String(
                                channel ||
                                ''
                            )
                                .trim()
                                .toLowerCase()
                    )
                )
            ];

        if (uniqueChannels.some(
            channel =>
                ![
                    'instagram',
                    'facebook'
                ].includes(channel)
        )) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_CHANNEL',
                    message: 'Canal de preparação inválido.'
                }
            });
        }

        const entry =
            defaultVitrine2Service.getProduct(
                marketplace,
                itemId
            );

        if (!entry) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'PRODUCT_NOT_FOUND',
                    message: 'Produto não encontrado no catálogo.'
                }
            });
        }

        const results =
            await Promise.all(
                uniqueChannels.map(
                    async channel => {
                        try {
                            return [
                                channel,
                                await prepareChannel(
                                    channel,
                                    marketplace,
                                    itemId
                                )
                            ];
                        } catch (error) {
                            console.error(
                                `[MARKETING] Erro ao preparar ${channel}:`,
                                error
                            );

                            return [
                                channel,
                                {
                                    status: 'ERROR',
                                    error: {
                                        code:
                                            error?.code ||
                                            'PREPARATION_FAILED',

                                        message:
                                            error?.message ||
                                            `Não foi possível preparar ${channel}.`
                                    }
                                }
                            ];
                        }
                    }
                )
            );

        console.log('[MARKETING DEBUG] Promise.all terminou');

        const channelResults =
            Object.fromEntries(
                results
            );

        console.log(
            '[MARKETING DEBUG] channelResults montado',
            Object.keys(channelResults)
        );

        console.log(
            '[MARKETING DEBUG] enviando res.json'
        );

        const responseBody = {
            success:
                Object.values(
                    channelResults
                )
                    .every(
                        result =>
                            result.status !==
                            'ERROR'
                    ),

            productId:
                itemId,

            channels:
                channelResults
        };

        console.log(
            '[MARKETING DEBUG] antes do JSON.stringify'
        );

        const serialized =
            JSON.stringify(responseBody);

        console.log(
            '[MARKETING DEBUG] JSON.stringify OK',
            serialized.length,
            'bytes'
        );

        const sentResponse =
            res.json(responseBody);

        console.log(
            '[MARKETING DEBUG] res.json retornou',
            {
                headersSent:
                    res.headersSent,
                writableEnded:
                    res.writableEnded
            }
        );

        return sentResponse;
    }
);


router.post(
    '/meta/publish',
    async (req, res) => {
        if (
            process.env.NODE_ENV ===
            'production'
        ) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Rota não encontrada.'
                }
            });
        }

        const body = req.body || {};
        const imageUrl = body.imageUrl;
        const caption = body.caption;
        const channels = body.channels;

        if (
            typeof imageUrl !==
                'string' ||
            !imageUrl.trim()
        ) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'IMAGE_URL_REQUIRED',
                    message: 'imageUrl é obrigatória.'
                }
            });
        }

        if (
            typeof caption !==
            'string'
        ) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_CAPTION',
                    message: 'caption deve ser uma string.'
                }
            });
        }

        if (
            !Array.isArray(channels) ||
            channels.length === 0
        ) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CHANNELS_REQUIRED',
                    message: 'Informe pelo menos um canal.'
                }
            });
        }

        if (
            channels.some(
                channel =>
                    ![
                        'instagram',
                        'facebook'
                    ].includes(channel)
            )
        ) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_CHANNEL',
                    message: 'Canal de publicação inválido.'
                }
            });
        }

        try {
            const result =
                await metaPublisher
                    .publishToChannels({
                        imageUrl:
                            imageUrl.trim(),

                        caption,

                        channels
                    });

            return res.json(
                result
            );
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: {
                    code:
                        error &&
                        error.code
                            ? error.code
                            : 'META_PUBLICATION_ERROR',

                    message:
                        'Não foi possível processar a publicação.'
                }
            });
        }
    }
);


module.exports =
    router;

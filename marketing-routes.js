'use strict';

const fs =
    require('node:fs');

const path =
    require('node:path');

const express =
    require('express');

const {
    captureShopeeMedia
} = require('./shopee-browser-media-capture');

const {
    generateReel
} = require('./marketing/reel-generator');

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

const publicationHistoryStore =
    require('./marketing/publication-history-store');


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
    '/media/reel',
    async (req, res) => {
        const body =
            req.body || {};

        const imageUrls =
            Array.isArray(body.imageUrls)
                ? body.imageUrls
                : [];

        if (imageUrls.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code:
                        'REEL_IMAGES_REQUIRED',

                    message:
                        'Informe pelo menos uma imagem para gerar o Reel.'
                }
            });
        }

        if (imageUrls.length > 5) {
            return res.status(400).json({
                success: false,
                error: {
                    code:
                        'REEL_TOO_MANY_IMAGES',

                    message:
                        'O Reel aceita no máximo 5 imagens nesta etapa.'
                }
            });
        }

        try {
            const result =
                await generateReel({
                    imageUrls
                });

            const videoUrl =
                '/admin/vitrine2/marketing/media/reel/' +
                encodeURIComponent(
                    result.jobId
                );

            return res.json({
                success: true,

                jobId:
                    result.jobId,

                videoUrl,

                imageCount:
                    result.imageCount,

                width:
                    result.width,

                height:
                    result.height,

                fps:
                    result.fps,

                durationSeconds:
                    result.durationSeconds
            });
        } catch (error) {
            console.error(
                '[MARKETING REEL] Falha ao gerar Reel:',
                error?.code || '',
                error?.message || error
            );

            const validationCodes =
                new Set([
                    'REEL_IMAGES_REQUIRED',
                    'REEL_INVALID_IMAGE_URL'
                ]);

            const status =
                validationCodes.has(
                    error?.code
                )
                    ? 400
                    : 500;

            return res.status(status).json({
                success: false,

                error: {
                    code:
                        error?.code ||
                        'REEL_GENERATION_FAILED',

                    message:
                        status === 400
                            ? error.message
                            : 'Não foi possível gerar o Reel.'
                }
            });
        }
    }
);


router.get(
    '/media/reel/:jobId',
    (req, res) => {
        const jobId =
            String(
                req.params.jobId ||
                ''
            ).trim();

        if (
            !/^[a-zA-Z0-9_-]+$/.test(
                jobId
            )
        ) {
            return res.status(400).json({
                success: false,

                error: {
                    code:
                        'INVALID_REEL_JOB_ID',

                    message:
                        'Identificador do Reel inválido.'
                }
            });
        }

        const reelPath =
            path.join(
                process.cwd(),
                'tmp',
                'reels',
                jobId,
                'reel.mp4'
            );

        if (
            !fs.existsSync(
                reelPath
            )
        ) {
            return res.status(404).json({
                success: false,

                error: {
                    code:
                        'REEL_NOT_FOUND',

                    message:
                        'Reel não encontrado.'
                }
            });
        }

        res.set(
            'Cache-Control',
            'no-store'
        );

        res.type(
            'video/mp4'
        );

        return res.sendFile(
            reelPath
        );
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


router.get(
    '/publication-history',
    async (req, res) => {
        const marketplace =
            String(
                req.query.marketplace ||
                'shopee'
            )
                .trim()
                .toLowerCase();

        const itemId =
            String(
                req.query.itemId ||
                ''
            ).trim();

        if (!/^\d+$/.test(itemId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code:
                        'INVALID_ITEM_ID',

                    message:
                        'itemId inválido.'
                }
            });
        }

        try {
            const publications =
                await publicationHistoryStore
                    .listProductPublications({
                        marketplace,
                        itemId
                    });

            return res.json({
                success: true,
                marketplace,
                itemId,
                publications
            });
        } catch (error) {
            console.error(
                '[MARKETING HISTORY] Falha:',
                error?.message || error
            );

            return res.status(500).json({
                success: false,
                error: {
                    code:
                        'PUBLICATION_HISTORY_ERROR',

                    message:
                        'Não foi possível consultar o histórico.'
                }
            });
        }
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
                    message:
                        'Rota não encontrada.'
                }
            });
        }

        const body =
            req.body || {};

        const caption =
            body.caption;

        const channels =
            body.channels;

        const marketplace =
            String(
                body.marketplace ||
                'shopee'
            )
                .trim()
                .toLowerCase();

        const itemId =
            String(
                body.itemId ||
                ''
            ).trim();

        const format =
            String(
                body.format ||
                'photo'
            )
                .trim()
                .toLowerCase();


        if (
            ![
                'photo',
                'carousel'
            ].includes(format)
        ) {
            return res.status(400).json({
                success: false,
                error: {
                    code:
                        'FORMAT_NOT_SUPPORTED',

                    message:
                        'Formato de publicação inválido.'
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
                    code:
                        'INVALID_CAPTION',

                    message:
                        'caption deve ser uma string.'
                }
            });
        }


        if (!/^\d+$/.test(itemId)) {
            return res.status(400).json({
                success: false,
                error: {
                    code:
                        'INVALID_ITEM_ID',

                    message:
                        'itemId inválido.'
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
                    code:
                        'CHANNELS_REQUIRED',

                    message:
                        'Informe pelo menos um canal.'
                }
            });
        }


        const uniqueChannels =
            [
                ...new Set(
                    channels
                )
            ];


        if (
            uniqueChannels.some(
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
                    code:
                        'INVALID_CHANNEL',

                    message:
                        'Canal de publicação inválido.'
                }
            });
        }


        /*
         * FOTO
         */
        let normalizedImageUrl =
            null;


        if (format === 'photo') {
            normalizedImageUrl =
                String(
                    body.imageUrl ||
                    ''
                ).trim();

            if (!normalizedImageUrl) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code:
                            'IMAGE_URL_REQUIRED',

                        message:
                            'imageUrl é obrigatória.'
                    }
                });
            }
        }


        /*
         * CARROSSEL
         */
        let normalizedImageUrls =
            [];


        if (format === 'carousel') {
            normalizedImageUrls =
                Array.isArray(
                    body.imageUrls
                )
                    ? [
                        ...new Set(
                            body.imageUrls
                                .map(
                                    value =>
                                        String(
                                            value ||
                                            ''
                                        ).trim()
                                )
                                .filter(Boolean)
                        )
                    ]
                    : [];


            if (
                normalizedImageUrls.length < 2 ||
                normalizedImageUrls.length > 5
            ) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code:
                            'CAROUSEL_IMAGES_INVALID',

                        message:
                            'O Carrossel precisa ter entre 2 e 5 imagens.'
                    }
                });
            }


            if (
                uniqueChannels.length !== 1 ||
                uniqueChannels[0] !==
                    'instagram'
            ) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code:
                            'CAROUSEL_CHANNEL_NOT_SUPPORTED',

                        message:
                            'Nesta etapa o Carrossel está disponível apenas para Instagram.'
                    }
                });
            }
        }


        const reservedChannels =
            [];


        try {
            /*
             * Reserva Produto + Canal + Formato.
             */
            for (
                const channel
                of uniqueChannels
            ) {
                const reservation =
                    await publicationHistoryStore
                        .beginPublication({
                            marketplace,
                            itemId,
                            channel,
                            format
                        });


                if (
                    !reservation.allowed
                ) {
                    for (
                        const reservedChannel
                        of reservedChannels
                    ) {
                        await publicationHistoryStore
                            .markFailed({
                                marketplace,
                                itemId,
                                channel:
                                    reservedChannel,
                                format
                            });
                    }


                    return res.status(409).json({
                        success: false,

                        error: {
                            code:
                                'PUBLICATION_ALREADY_EXISTS',

                            message:
                                'Este formato já foi publicado ou está em processamento.'
                        },

                        publication:
                            reservation.publication
                    });
                }


                reservedChannels.push(
                    channel
                );
            }


            let result;


            /*
             * PUBLICAÇÃO DA FOTO
             */
            if (format === 'photo') {
                result =
                    await metaPublisher
                        .publishToChannels({
                            imageUrl:
                                normalizedImageUrl,

                            caption,

                            channels:
                                uniqueChannels
                        });
            }


            /*
             * PUBLICAÇÃO DO CARROSSEL
             */
            if (format === 'carousel') {
                const instagramResult =
                    await metaPublisher
                        .publishInstagramCarousel({
                            imageUrls:
                                normalizedImageUrls,

                            caption
                        });


                result = {
                    success:
                        true,

                    channels: {
                        instagram:
                            instagramResult
                    }
                };
            }


            /*
             * Grava o resultado no histórico.
             */
            const savedPublications =
                {};


            for (
                const channel
                of uniqueChannels
            ) {
                const channelResult =
                    result
                        ?.channels
                        ?.[channel];


                if (
                    channelResult
                        ?.success
                ) {
                    const mediaId =
                        channelResult.mediaId ||
                        channelResult.photoId ||
                        channelResult.postId ||
                        null;


                    savedPublications[
                        channel
                    ] =
                        await publicationHistoryStore
                            .markPublished({
                                marketplace,
                                itemId,
                                channel,
                                format,
                                mediaId
                            });
                } else {
                    await publicationHistoryStore
                        .markFailed({
                            marketplace,
                            itemId,
                            channel,
                            format
                        });
                }
            }


            return res.json({
                ...result,

                format,

                publications:
                    savedPublications
            });

        } catch (error) {

            for (
                const channel
                of reservedChannels
            ) {
                try {
                    await publicationHistoryStore
                        .markFailed({
                            marketplace,
                            itemId,
                            channel,
                            format
                        });
                } catch (_) {
                    // Não mascara o erro original.
                }
            }


            console.error(
                '[MARKETING PUBLISH] Falha:',
                error?.code || '',
                error?.message || error
            );


            return res.status(500).json({
                success: false,

                error: {
                    code:
                        error?.code ||
                        'META_PUBLICATION_ERROR',

                    message:
                        error?.message ||
                        'Não foi possível processar a publicação.'
                }
            });
        }
    }
);

module.exports =
    router;

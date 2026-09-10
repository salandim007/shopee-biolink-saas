'use strict';

const {
    defaultVitrine2Service
} = require('../vitrine2-service');

const publicationHistoryStore =
    require('./publication-history-store');


function isAllowedShopeeAffiliateUrl(
    value
) {
    try {
        const url =
            new URL(
                String(
                    value || ''
                ).trim()
            );

        if (
            url.protocol !==
            'https:'
        ) {
            return false;
        }

        const hostname =
            url.hostname
                .toLowerCase();

        if (
            hostname ===
                'shope.ee'
        ) {
            return true;
        }

        if (
            hostname ===
                'shopee.com.br' ||
            hostname.endsWith(
                '.shopee.com.br'
            )
        ) {
            return true;
        }

        return false;

    } catch (_) {
        return false;
    }
}


async function resolveAffiliateLinkByMediaId({
    channel = 'instagram',
    mediaId
}) {
    const normalizedMediaId =
        String(
            mediaId || ''
        ).trim();

    if (!normalizedMediaId) {
        throw new Error(
            'mediaId é obrigatório.'
        );
    }


    /*
     * 1. Descobrir qual produto originou
     *    a publicação do Instagram.
     */
    const publication =
        await publicationHistoryStore
            .getPublicationByMediaId({
                channel,
                mediaId:
                    normalizedMediaId
            });


    if (!publication) {
        throw new Error(
            'Publicação não encontrada no histórico.'
        );
    }


    /*
     * 2. Encontrar o produto no catálogo.
     */
    const entry =
        defaultVitrine2Service
            .getProduct(
                publication.marketplace,
                publication.itemId
            );


    if (
        !entry ||
        !entry.product
    ) {
        throw new Error(
            'Produto da publicação não encontrado no catálogo.'
        );
    }


    /*
     * 3. Usar somente o affiliateLink
     *    oficial armazenado no produto.
     */
    const affiliateLink =
        String(
            entry.product
                .affiliateLink ||
            ''
        ).trim();


    if (!affiliateLink) {
        throw new Error(
            'Produto sem link de afiliado.'
        );
    }


    /*
     * 4. Não enviar URLs externas inesperadas.
     */
    if (
        !isAllowedShopeeAffiliateUrl(
            affiliateLink
        )
    ) {
        throw new Error(
            'Link de afiliado fora dos domínios Shopee permitidos.'
        );
    }


    return {
        success:
            true,

        channel:
            publication.channel,

        format:
            publication.format,

        mediaId:
            publication.mediaId,

        marketplace:
            publication.marketplace,

        itemId:
            publication.itemId,

        title:
            entry.product.title ||
            null,

        affiliateLink
    };
}


module.exports = {
    isAllowedShopeeAffiliateUrl,
    resolveAffiliateLinkByMediaId
};

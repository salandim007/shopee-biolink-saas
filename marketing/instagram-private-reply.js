'use strict';

const {
    isAllowedShopeeAffiliateUrl
} = require('./lead-link-resolver');


class InstagramPrivateReplyError
    extends Error {

    constructor(
        message,
        code =
            'INSTAGRAM_PRIVATE_REPLY_ERROR',
        details =
            null
    ) {
        super(message);

        this.name =
            'InstagramPrivateReplyError';

        this.code =
            code;

        this.details =
            details;
    }
}


async function readJsonResponse(
    response
) {
    try {
        return await response.json();
    } catch (_) {
        return {};
    }
}


async function getInstagramAccountId({
    accessToken,
    env = process.env
}) {
    const configuredId =
        String(
            env.INSTAGRAM_USER_ID ||
            ''
        ).trim();


    if (configuredId) {
        return configuredId;
    }


    const response =
        await fetch(
            'https://graph.instagram.com/v24.0/me?fields=id',
            {
                method:
                    'GET',

                headers: {
                    Authorization:
                        `Bearer ${accessToken}`
                }
            }
        );


    const payload =
        await readJsonResponse(
            response
        );


    if (
        !response.ok ||
        !payload?.id
    ) {
        throw new InstagramPrivateReplyError(
            'Não foi possível identificar a conta do Instagram.',
            'INSTAGRAM_ACCOUNT_ID_ERROR',
            payload?.error || null
        );
    }


    return String(
        payload.id
    );
}


async function sendInstagramPrivateReply({
    commentId,
    affiliateLink,
    env = process.env
}) {
    const accessToken =
        String(
            env.INSTAGRAM_ACCESS_TOKEN ||
            ''
        ).trim();


    if (!accessToken) {
        throw new InstagramPrivateReplyError(
            'Token do Instagram não configurado.',
            'INSTAGRAM_CREDENTIAL_MISSING'
        );
    }


    const normalizedCommentId =
        String(
            commentId || ''
        ).trim();


    if (!normalizedCommentId) {
        throw new InstagramPrivateReplyError(
            'commentId é obrigatório.',
            'INSTAGRAM_COMMENT_ID_REQUIRED'
        );
    }


    const normalizedAffiliateLink =
        String(
            affiliateLink || ''
        ).trim();


    /*
     * Defesa adicional:
     * o EU QUERO nunca envia uma URL
     * que não seja um link Shopee permitido.
     */
    if (
        !isAllowedShopeeAffiliateUrl(
            normalizedAffiliateLink
        )
    ) {
        throw new InstagramPrivateReplyError(
            'Link de afiliado inválido para envio.',
            'INVALID_AFFILIATE_LINK'
        );
    }


    const instagramAccountId =
        await getInstagramAccountId({
            accessToken,
            env
        });


    /*
     * Regra oficial do nosso SaaS:
     *
     * SOMENTE O LINK.
     * Sem saudação.
     * Sem segunda mensagem.
     * Sem sequência automática.
     */
    const response =
        await fetch(
            `https://graph.instagram.com/v24.0/${encodeURIComponent(instagramAccountId)}/messages`,
            {
                method:
                    'POST',

                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,

                    'Content-Type':
                        'application/json'
                },

                body:
                    JSON.stringify({
                        recipient: {
                            comment_id:
                                normalizedCommentId
                        },

                        message: {
                            text:
                                normalizedAffiliateLink
                        }
                    })
            }
        );


    const payload =
        await readJsonResponse(
            response
        );


    if (
        !response.ok ||
        payload?.error
    ) {
        throw new InstagramPrivateReplyError(
            payload
                ?.error
                ?.message ||
            'Instagram recusou a resposta privada.',
            payload
                ?.error
                ?.code
                ? `META_${payload.error.code}`
                : 'INSTAGRAM_PRIVATE_REPLY_FAILED',
            payload?.error || null
        );
    }


    if (!payload?.message_id) {
        throw new InstagramPrivateReplyError(
            'Instagram não retornou message_id.',
            'INSTAGRAM_PRIVATE_REPLY_MESSAGE_ID_MISSING'
        );
    }


    return {
        success:
            true,

        instagramAccountId,

        recipientId:
            payload.recipient_id
                ? String(
                    payload.recipient_id
                )
                : null,

        messageId:
            String(
                payload.message_id
            ),

        commentId:
            normalizedCommentId,

        affiliateLink:
            normalizedAffiliateLink
    };
}


module.exports = {
    InstagramPrivateReplyError,
    getInstagramAccountId,
    sendInstagramPrivateReply
};

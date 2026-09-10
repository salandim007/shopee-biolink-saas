'use strict';

const leadStore =
    require('./lead-engine-store');

const {
    resolveAffiliateLinkByMediaId
} = require('./lead-link-resolver');


function normalizeTriggerText(
    value
) {
    return String(
        value || ''
    )
        .normalize('NFKD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .toUpperCase()
        .replace(
            /[^A-Z0-9\s]/g,
            ' '
        )
        .replace(
            /\s+/g,
            ' '
        )
        .trim();
}


function isEuQueroTrigger(
    value
) {
    return (
        normalizeTriggerText(
            value
        ) === 'EU QUERO'
    );
}


async function prepareEuQueroReply({
    platform = 'instagram',
    commentId,
    mediaId,
    externalUserId,
    username = null,
    commentText
}) {
    const normalizedPlatform =
        String(
            platform || ''
        )
            .trim()
            .toLowerCase();


    /*
     * Só reage ao comando EU QUERO.
     *
     * Exemplo aceito:
     *   EU QUERO
     *   eu quero
     *   Eu Quero!!!
     *
     * Outros comentários são ignorados.
     */
    if (
        !isEuQueroTrigger(
            commentText
        )
    ) {
        return {
            success:
                true,

            action:
                'IGNORED',

            reason:
                'COMMENT_NOT_TRIGGER'
        };
    }


    /*
     * Descobre qual produto pertence
     * à publicação e pega o link
     * de afiliado correto.
     */
    const resolved =
        await resolveAffiliateLinkByMediaId({
            channel:
                normalizedPlatform,

            mediaId
        });


    /*
     * Registra o comentário antes
     * de qualquer envio.
     *
     * commentId repetido não pode
     * gerar uma segunda mensagem.
     */
    const registration =
        await leadStore.registerRequest({
            platform:
                normalizedPlatform,

            commentId,

            mediaId:
                resolved.mediaId,

            externalUserId,

            username,

            marketplace:
                resolved.marketplace,

            itemId:
                resolved.itemId,

            format:
                resolved.format,

            commentText:
                'EU QUERO',

            triggerKeyword:
                'EU QUERO'
        });


    if (
        registration.duplicate
    ) {
        return {
            success:
                true,

            action:
                'DUPLICATE',

            sendMessage:
                false,

            request:
                registration.request
        };
    }


    /*
     * Decisão oficial do projeto:
     *
     * enviar apenas o link solicitado.
     * Sem conversa automática,
     * sem sequência de mensagens.
     */
    return {
        success:
            true,

        action:
            'SEND_LINK',

        sendMessage:
            true,

        message:
            resolved.affiliateLink,

        product: {
            marketplace:
                resolved.marketplace,

            itemId:
                resolved.itemId,

            title:
                resolved.title,

            format:
                resolved.format,

            mediaId:
                resolved.mediaId
        },

        affiliateLink:
            resolved.affiliateLink,

        request:
            registration.request
    };
}


module.exports = {
    normalizeTriggerText,
    isEuQueroTrigger,
    prepareEuQueroReply
};

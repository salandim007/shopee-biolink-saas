'use strict';

const express =
    require('express');

const {
    prepareEuQueroReply
} = require('./eu-quero-service');

const {
    sendInstagramPrivateReply
} = require('./instagram-private-reply');

const leadStore =
    require('./lead-engine-store');


function createInstagramWebhookRouter(
    options = {}
) {
    const env =
        options.env ||
        process.env;

    const router =
        express.Router();


    /*
     * ========================================================
     * VERIFICAÇÃO DO WEBHOOK PELA META
     * ========================================================
     */
    router.get(
        '/',
        (req, res) => {
            const mode =
                String(
                    req.query[
                        'hub.mode'
                    ] ||
                    ''
                );

            const verifyToken =
                String(
                    req.query[
                        'hub.verify_token'
                    ] ||
                    ''
                );

            const challenge =
                String(
                    req.query[
                        'hub.challenge'
                    ] ||
                    ''
                );


            const expectedToken =
                String(
                    env
                        .INSTAGRAM_WEBHOOK_VERIFY_TOKEN ||
                    ''
                );


            console.log(
                '[META VERIFY]',
                {
                    mode,
                    tokenReceived:
                        Boolean(verifyToken),
                    expectedTokenLoaded:
                        Boolean(expectedToken),
                    tokenMatches:
                        Boolean(
                            expectedToken &&
                            verifyToken === expectedToken
                        ),
                    challengeReceived:
                        Boolean(challenge)
                }
            );


            if (
                mode === 'subscribe' &&
                expectedToken &&
                verifyToken ===
                    expectedToken
            ) {
                return res
                    .status(200)
                    .send(
                        challenge
                    );
            }


            return res
                .sendStatus(403);
        }
    );


    /*
     * ========================================================
     * BUSINESS LOGIN FOR INSTAGRAM / OAUTH
     * ========================================================
     */

    const instagramOAuthStates =
        new Map();


    router.get(
        '/oauth/start',
        (req, res) => {
            const appId =
                String(
                    env.INSTAGRAM_APP_ID ||
                    ''
                ).trim();

            const redirectUri =
                String(
                    env.INSTAGRAM_OAUTH_REDIRECT_URI ||
                    ''
                ).trim();


            if (
                !appId ||
                !redirectUri
            ) {
                return res
                    .status(500)
                    .send(
                        'Configuração OAuth do Instagram incompleta.'
                    );
            }


            const state =
                require('crypto')
                    .randomBytes(24)
                    .toString('hex');


            instagramOAuthStates.set(
                state,
                Date.now()
            );


            /*
             * Remove states antigos.
             */
            const now =
                Date.now();

            for (
                const [savedState, createdAt]
                of instagramOAuthStates
            ) {
                if (
                    now - createdAt >
                    10 * 60 * 1000
                ) {
                    instagramOAuthStates.delete(
                        savedState
                    );
                }
            }


            const authUrl =
                new URL(
                    'https://www.instagram.com/oauth/authorize'
                );

            authUrl.searchParams.set(
                'client_id',
                appId
            );

            authUrl.searchParams.set(
                'redirect_uri',
                redirectUri
            );

            authUrl.searchParams.set(
                'response_type',
                'code'
            );

            authUrl.searchParams.set(
                'scope',
                [
                    'instagram_business_basic',
                    'instagram_business_manage_comments',
                    'instagram_business_manage_messages',
                    'instagram_business_content_publish'
                ].join(',')
            );

            authUrl.searchParams.set(
                'state',
                state
            );

            authUrl.searchParams.set(
                'force_reauth',
                'true'
            );


            return res.redirect(
                authUrl.toString()
            );
        }
    );


    router.get(
        '/oauth/callback',
        async (req, res) => {
            const code =
                String(
                    req.query.code ||
                    ''
                ).trim();

            const state =
                String(
                    req.query.state ||
                    ''
                ).trim();

            const oauthError =
                String(
                    req.query.error ||
                    ''
                ).trim();


            if (oauthError) {
                console.error(
                    '[INSTAGRAM OAUTH] Autorização recusada:',
                    oauthError
                );

                return res
                    .status(400)
                    .send(
                        'A autorização do Instagram foi cancelada ou recusada.'
                    );
            }


            const savedAt =
                instagramOAuthStates.get(
                    state
                );


            if (
                !state ||
                !savedAt ||
                Date.now() - savedAt >
                    10 * 60 * 1000
            ) {
                return res
                    .status(400)
                    .send(
                        'Estado OAuth inválido ou expirado.'
                    );
            }


            instagramOAuthStates.delete(
                state
            );


            if (!code) {
                return res
                    .status(400)
                    .send(
                        'O Instagram não retornou o código de autorização.'
                    );
            }


            const appId =
                String(
                    env.INSTAGRAM_APP_ID ||
                    ''
                ).trim();

            const appSecret =
                String(
                    env.INSTAGRAM_APP_SECRET ||
                    ''
                ).trim();

            const redirectUri =
                String(
                    env.INSTAGRAM_OAUTH_REDIRECT_URI ||
                    ''
                ).trim();


            if (
                !appId ||
                !appSecret ||
                !redirectUri
            ) {
                return res
                    .status(500)
                    .send(
                        'Credenciais OAuth do Instagram não configuradas no servidor.'
                    );
            }


            try {
                /*
                 * Troca o CODE por token curto.
                 */
                const form =
                    new FormData();

                form.append(
                    'client_id',
                    appId
                );

                form.append(
                    'client_secret',
                    appSecret
                );

                form.append(
                    'grant_type',
                    'authorization_code'
                );

                form.append(
                    'redirect_uri',
                    redirectUri
                );

                form.append(
                    'code',
                    code
                );


                const tokenResponse =
                    await fetch(
                        'https://api.instagram.com/oauth/access_token',
                        {
                            method:
                                'POST',

                            body:
                                form
                        }
                    );


                const tokenPayload =
                    await tokenResponse.json();


                if (
                    !tokenResponse.ok ||
                    !tokenPayload
                        ?.access_token
                ) {
                    console.error(
                        '[INSTAGRAM OAUTH] Falha ao trocar code.',
                        {
                            status:
                                tokenResponse.status
                        }
                    );

                    return res
                        .status(502)
                        .send(
                            'O Instagram não forneceu o token de acesso.'
                        );
                }


                const shortToken =
                    String(
                        tokenPayload.access_token
                    );


                /*
                 * Troca pelo token de longa duração.
                 */
                const longUrl =
                    new URL(
                        'https://graph.instagram.com/access_token'
                    );

                longUrl.searchParams.set(
                    'grant_type',
                    'ig_exchange_token'
                );

                longUrl.searchParams.set(
                    'client_secret',
                    appSecret
                );

                longUrl.searchParams.set(
                    'access_token',
                    shortToken
                );


                const longResponse =
                    await fetch(
                        longUrl.toString()
                    );

                const longPayload =
                    await longResponse.json();


                const finalToken =
                    longResponse.ok &&
                    longPayload
                        ?.access_token
                        ? String(
                            longPayload
                                .access_token
                        )
                        : shortToken;


                /*
                 * Confirma qual conta autorizou.
                 */
                const apiVersion =
                    String(
                        env
                            .INSTAGRAM_GRAPH_API_VERSION ||
                        'v24.0'
                    );

                const profileResponse =
                    await fetch(
                        `https://graph.instagram.com/${apiVersion}/me?fields=id,user_id,username,account_type`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${finalToken}`
                            }
                        }
                    );

                const profile =
                    await profileResponse.json();


                if (
                    !profileResponse.ok ||
                    !profile
                        ?.id
                ) {
                    return res
                        .status(502)
                        .send(
                            'Token criado, mas não foi possível confirmar a conta do Instagram.'
                        );
                }


                /*
                 * Instala o token no processo atual.
                 * Não grava o token em log.
                 */
                env.INSTAGRAM_ACCESS_TOKEN =
                    finalToken;


                console.log(
                    '[INSTAGRAM OAUTH] Conta conectada:',
                    {
                        username:
                            profile.username ||
                            null,

                        id:
                            String(
                                profile.id
                            ),

                        userId:
                            profile.user_id
                                ? String(
                                    profile.user_id
                                )
                                : null,

                        longLived:
                            Boolean(
                                longPayload
                                    ?.access_token
                            )
                    }
                );


                return res
                    .status(200)
                    .send(`
                        <!doctype html>
                        <html lang="pt-BR">
                            <head>
                                <meta charset="utf-8">
                                <title>Instagram conectado</title>
                            </head>
                            <body style="
                                font-family:Arial,sans-serif;
                                max-width:600px;
                                margin:60px auto;
                                padding:24px;
                            ">
                                <h1>Instagram conectado ✅</h1>
                                <p>
                                    Conta autorizada:
                                    <strong>${
                                        String(
                                            profile.username ||
                                            ''
                                        )
                                    }</strong>
                                </p>
                                <p>
                                    Você pode fechar esta janela.
                                </p>
                            </body>
                        </html>
                    `);
            }
            catch (error) {
                console.error(
                    '[INSTAGRAM OAUTH] Falha:',
                    error?.message ||
                    error
                );

                return res
                    .status(500)
                    .send(
                        'Falha ao concluir a autorização do Instagram.'
                    );
            }
        }
    );


    /*
     * ========================================================
     * DIAGNÓSTICO TEMPORÁRIO - WEBHOOK SUBSCRIPTIONS
     * ========================================================
     */
    router.get(
        '/oauth/subscriptions',
        async (req, res) => {
            const accessToken =
                String(
                    env.INSTAGRAM_ACCESS_TOKEN ||
                    ''
                ).trim();

            if (!accessToken) {
                return res
                    .status(500)
                    .json({
                        success: false,
                        error: 'INSTAGRAM_ACCESS_TOKEN_NOT_LOADED'
                    });
            }

            try {
                const apiVersion =
                    String(
                        env.INSTAGRAM_GRAPH_API_VERSION ||
                        'v24.0'
                    );

                const response =
                    await fetch(
                        `https://graph.instagram.com/${apiVersion}/me/subscribed_apps`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${accessToken}`
                            }
                        }
                    );

                const payload =
                    await response.json();

                return res
                    .status(response.ok ? 200 : 502)
                    .json({
                        success:
                            response.ok,
                        subscriptions:
                            payload?.data || [],
                        metaError:
                            response.ok
                                ? null
                                : payload?.error?.message || null
                    });
            }
            catch (error) {
                return res
                    .status(500)
                    .json({
                        success: false,
                        error:
                            error?.message ||
                            'SUBSCRIPTION_CHECK_FAILED'
                    });
            }
        }
    );


    /*
     * ========================================================
     * DIAGNÓSTICO TEMPORÁRIO - COMENTÁRIOS COM TOKEN OAUTH
     * ========================================================
     */
    router.get(
        '/oauth/media-comments',
        async (req, res) => {
            const accessToken =
                String(
                    env.INSTAGRAM_ACCESS_TOKEN ||
                    ''
                ).trim();

            const mediaId =
                String(
                    req.query.mediaId ||
                    ''
                ).trim();


            if (!accessToken) {
                return res
                    .status(500)
                    .json({
                        success: false,
                        error: 'INSTAGRAM_ACCESS_TOKEN_NOT_LOADED'
                    });
            }


            if (!mediaId) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        error: 'MEDIA_ID_REQUIRED'
                    });
            }


            try {
                const apiVersion =
                    String(
                        env.INSTAGRAM_GRAPH_API_VERSION ||
                        'v24.0'
                    );


                const mediaResponse =
                    await fetch(
                        `https://graph.instagram.com/${apiVersion}/${encodeURIComponent(mediaId)}?fields=id,media_type,comments_count`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${accessToken}`
                            }
                        }
                    );

                const media =
                    await mediaResponse.json();


                const commentsResponse =
                    await fetch(
                        `https://graph.instagram.com/${apiVersion}/${encodeURIComponent(mediaId)}/comments?fields=id,text,username,timestamp&limit=50`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${accessToken}`
                            }
                        }
                    );

                const comments =
                    await commentsResponse.json();


                return res.json({
                    success:
                        mediaResponse.ok &&
                        commentsResponse.ok,

                    media: {
                        ok:
                            mediaResponse.ok,

                        id:
                            media?.id || null,

                        mediaType:
                            media?.media_type || null,

                        commentsCount:
                            media?.comments_count ?? null
                    },

                    commentsRequest: {
                        ok:
                            commentsResponse.ok,

                        count:
                            Array.isArray(
                                comments?.data
                            )
                                ? comments.data.length
                                : null,

                        data:
                            Array.isArray(
                                comments?.data
                            )
                                ? comments.data
                                : [],

                        error:
                            commentsResponse.ok
                                ? null
                                : comments?.error?.message || null
                    }
                });
            }
            catch (error) {
                return res
                    .status(500)
                    .json({
                        success: false,
                        error:
                            error?.message ||
                            'COMMENTS_CHECK_FAILED'
                    });
            }
        }
    );


    /*
     * ========================================================
     * RECEBE COMENTÁRIOS DO INSTAGRAM
     * ========================================================
     */
    router.post(
        '/',
        async (req, res) => {
            const body =
                req.body || {};

            console.log(
                '[INSTAGRAM WEBHOOK RAW]',
                JSON.stringify(
                    body,
                    null,
                    2
                )
            );


            if (
                body.object !==
                'instagram'
            ) {
                return res
                    .sendStatus(404);
            }


            const processed =
                [];


            const entries =
                Array.isArray(
                    body.entry
                )
                    ? body.entry
                    : [];


            /*
             * ========================================================
             * DIRECT / MESSAGES
             * ========================================================
             *
             * A Meta entrega mensagens do Instagram em:
             *
             * entry.messaging[]
             *
             * Nesta primeira etapa apenas capturamos os IDs
             * necessários para testar o card clicável.
             * O fluxo de comentários permanece inalterado.
             */
            for (
                const rawEntry
                of entries
            ) {
                const messagingEvents =
                    Array.isArray(
                        rawEntry?.messaging
                    )
                        ? rawEntry.messaging
                        : [];

                for (
                    const event
                    of messagingEvents
                ) {
                    const senderId =
                        String(
                            event
                                ?.sender
                                ?.id ||
                            ''
                        ).trim();

                    const recipientId =
                        String(
                            event
                                ?.recipient
                                ?.id ||
                            ''
                        ).trim();

                    const messageId =
                        String(
                            event
                                ?.message
                                ?.mid ||
                            ''
                        ).trim();

                    const messageText =
                        String(
                            event
                                ?.message
                                ?.text ||
                            ''
                        ).trim();


                    if (
                        !senderId ||
                        !messageId
                    ) {
                        continue;
                    }


                    console.log(
                        '[INSTAGRAM DIRECT]',
                        {
                            senderId,
                            recipientId,
                            messageId,
                            text:
                                messageText
                        }
                    );


                    processed.push({
                        action:
                            'DIRECT_MESSAGE_RECEIVED',

                        senderId,

                        messageId
                    });
                }
            }


            /*
             * A Meta pode entregar comentários em dois formatos:
             *
             * 1) entry.field / entry.value
             *
             * 2) entry.changes[].field / value
             *
             * Normalizamos os dois para o mesmo processamento.
             */
            const normalizedEntries =
                [];

            for (
                const entry
                of entries
            ) {
                if (entry?.field) {
                    normalizedEntries.push(
                        entry
                    );
                }

                const changes =
                    Array.isArray(
                        entry?.changes
                    )
                        ? entry.changes
                        : [];

                for (
                    const change
                    of changes
                ) {
                    normalizedEntries.push({
                        ...entry,

                        field:
                            change?.field,

                        value:
                            change?.value
                    });
                }
            }


            for (
                const entry
                of normalizedEntries
            ) {
                /*
                 * Webhook atual de comentários
                 * pode chegar como:
                 *
                 * entry.field = comments
                 * entry.value = {...}
                 */
                if (
                    entry?.field !==
                    'comments'
                ) {
                    continue;
                }


                const value =
                    entry.value ||
                    {};


                const commentId =
                    String(
                        value.id ||
                        ''
                    ).trim();


                const mediaId =
                    String(
                        value
                            ?.media
                            ?.id ||
                        ''
                    ).trim();


                const commentText =
                    String(
                        value.text ||
                        ''
                    ).trim();


                const username =
                    value
                        ?.from
                        ?.username
                        ? String(
                            value.from
                                .username
                        )
                        : null;


                /*
                 * Meta normalmente entrega
                 * o Instagram-scoped ID.
                 *
                 * Para teste controlado,
                 * username é fallback.
                 */
                const externalUserId =
                    String(
                        value
                            ?.from
                            ?.id ||
                        username ||
                        ''
                    ).trim();


                if (
                    !commentId ||
                    !mediaId ||
                    !externalUserId
                ) {
                    processed.push({
                        action:
                            'IGNORED',

                        reason:
                            'INCOMPLETE_COMMENT_EVENT'
                    });

                    continue;
                }


                try {
                    const result =
                        await prepareEuQueroReply({
                            platform:
                                'instagram',

                            commentId,

                            mediaId,

                            externalUserId,

                            username,

                            commentText
                        });


                    /*
                     * Não registrar username
                     * ou texto completo no console.
                     */
                    if (
                        result.action ===
                            'SEND_LINK' &&
                        result.sendMessage ===
                            true
                    ) {
                        try {
                            const sent =
                                await sendInstagramPrivateReply({
                                    commentId,
                                    affiliateLink:
                                        result.affiliateLink,
                                    env
                                });

                            await leadStore.markLinkSent({
                                platform:
                                    'instagram',

                                commentId,

                                affiliateLink:
                                    result.affiliateLink
                            });

                            processed.push({
                                commentId,
                                mediaId,
                                action:
                                    'LINK_SENT',

                                sendMessage:
                                    true,

                                messageId:
                                    sent.messageId
                            });

                            continue;

                        } catch (sendError) {
                            await leadStore.markFailed({
                                platform:
                                    'instagram',

                                commentId,

                                errorCode:
                                    sendError?.code ||
                                    'PRIVATE_REPLY_ERROR',

                                errorMessage:
                                    sendError?.message ||
                                    'Falha ao enviar link.'
                            });

                            console.error(
                                '[EU QUERO] Falha no Private Reply:',
                                sendError?.code || '',
                                sendError?.message ||
                                sendError
                            );

                            processed.push({
                                commentId,
                                mediaId,
                                action:
                                    'SEND_FAILED',

                                sendMessage:
                                    false
                            });

                            continue;
                        }
                    }


                    processed.push({
                        commentId,
                        mediaId,
                        action:
                            result.action,
                        sendMessage:
                            Boolean(
                                result.sendMessage
                            )
                    });


                } catch (error) {
                    console.error(
                        '[INSTAGRAM WEBHOOK] Falha:',
                        error?.message ||
                        error
                    );


                    processed.push({
                        commentId,
                        mediaId,
                        action:
                            'ERROR'
                    });
                }
            }


            console.log(
                '[INSTAGRAM WEBHOOK] Eventos:',
                processed
            );


            /*
             * A Meta precisa receber HTTP 200
             * quando o evento foi recebido.
             */
            return res
                .status(200)
                .json({
                    received:
                        true,

                    processed
                });
        }
    );


    return router;
}


const defaultInstagramWebhookRouter =
    createInstagramWebhookRouter();


module.exports = {
    createInstagramWebhookRouter,
    defaultInstagramWebhookRouter
};






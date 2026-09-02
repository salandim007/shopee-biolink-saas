'use strict';

const DEFAULT_TIMEOUT_MS = 15000;
const INSTAGRAM_STATUS_POLL_INTERVAL_MS = 1000;
const INSTAGRAM_STATUS_MAX_ATTEMPTS = 10;
const SUPPORTED_CHANNELS = new Set([
    'instagram',
    'facebook'
]);


class MetaPublisherError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'MetaPublisherError';
        this.code = code;
        this.status = details.status || null;
    }
}


function createMetaPublisher(options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const env = options.env || process.env;
    const sleepImpl = options.sleepImpl || (
        delayMs => new Promise(resolve => setTimeout(resolve, delayMs))
    );
    const timeoutMs =
        Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
            ? options.timeoutMs
            : DEFAULT_TIMEOUT_MS;

    if (typeof fetchImpl !== 'function') {
        throw new TypeError('A implementação de fetch é obrigatória.');
    }

    if (typeof sleepImpl !== 'function') {
        throw new TypeError('A implementação de sleep é obrigatória.');
    }

    async function getJson(url, channel) {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            timeoutMs
        );

        let response;

        try {
            response = await fetchImpl(url, {
                method: 'GET',
                signal: controller.signal
            });
        } catch (error) {
            if (error && error.name === 'AbortError') {
                throw new MetaPublisherError(
                    `Tempo limite excedido ao consultar o ${channel}.`,
                    'META_TIMEOUT'
                );
            }

            throw new MetaPublisherError(
                `Falha de comunicação ao consultar o ${channel}.`,
                'META_NETWORK_ERROR'
            );
        } finally {
            clearTimeout(timeout);
        }

        if (!response || !response.ok) {
            const status = response && Number.isInteger(response.status)
                ? response.status
                : null;

            throw new MetaPublisherError(
                status
                    ? `Falha do ${channel}: HTTP ${status}.`
                    : `Resposta HTTP inválida do ${channel}.`,
                'META_HTTP_ERROR',
                { status }
            );
        }

        try {
            return await response.json();
        } catch (error) {
            throw new MetaPublisherError(
                `Resposta inválida recebida do ${channel}.`,
                'META_INVALID_RESPONSE'
            );
        }
    }

    async function postForm(url, fields, channel) {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            timeoutMs
        );

        let response;

        try {
            response = await fetchImpl(url, {
                method: 'POST',
                headers: {
                    'content-type':
                        'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams(fields),
                signal: controller.signal
            });
        } catch (error) {
            if (error && error.name === 'AbortError') {
                throw new MetaPublisherError(
                    `Tempo limite excedido ao publicar no ${channel}.`,
                    'META_TIMEOUT'
                );
            }

            throw new MetaPublisherError(
                `Falha de comunicação ao publicar no ${channel}.`,
                'META_NETWORK_ERROR'
            );
        } finally {
            clearTimeout(timeout);
        }

        if (!response || !response.ok) {
            const status = response && Number.isInteger(response.status)
                ? response.status
                : null;

            throw new MetaPublisherError(
                status
                    ? `Falha do ${channel}: HTTP ${status}.`
                    : `Resposta HTTP inválida do ${channel}.`,
                'META_HTTP_ERROR',
                { status }
            );
        }

        try {
            return await response.json();
        } catch (error) {
            throw new MetaPublisherError(
                `Resposta inválida recebida do ${channel}.`,
                'META_INVALID_RESPONSE'
            );
        }
    }

    async function publishInstagram({ imageUrl, caption = '' }) {
        const accessToken = env.INSTAGRAM_ACCESS_TOKEN;

        if (!accessToken) {
            throw new MetaPublisherError(
                'Credencial do Instagram não configurada.',
                'INSTAGRAM_CREDENTIAL_MISSING'
            );
        }

        const container = await postForm(
            'https://graph.instagram.com/v24.0/me/media',
            {
                image_url: imageUrl,
                caption,
                access_token: accessToken
            },
            'Instagram'
        );

        if (!container || !container.id) {
            throw new MetaPublisherError(
                'Instagram não retornou o identificador do container.',
                'INSTAGRAM_CONTAINER_ID_MISSING'
            );
        }

        const containerId = String(container.id);
        let containerFinished = false;

        for (
            let attempt = 1;
            attempt <= INSTAGRAM_STATUS_MAX_ATTEMPTS;
            attempt += 1
        ) {
            const statusUrl = new URL(
                `https://graph.instagram.com/v24.0/${encodeURIComponent(containerId)}`
            );
            statusUrl.searchParams.set(
                'fields',
                'status_code,status'
            );
            statusUrl.searchParams.set(
                'access_token',
                accessToken
            );

            const containerStatus = await getJson(
                statusUrl.toString(),
                'Instagram'
            );
            const statusCode = containerStatus && containerStatus.status_code;

            if (statusCode === 'FINISHED') {
                containerFinished = true;
                break;
            }

            if (
                statusCode === 'ERROR' ||
                statusCode === 'EXPIRED' ||
                statusCode === 'PUBLISHED'
            ) {
                throw new MetaPublisherError(
                    'O container do Instagram não pode ser publicado.',
                    'INSTAGRAM_CONTAINER_FAILED'
                );
            }

            if (attempt < INSTAGRAM_STATUS_MAX_ATTEMPTS) {
                await sleepImpl(INSTAGRAM_STATUS_POLL_INTERVAL_MS);
            }
        }

        if (!containerFinished) {
            throw new MetaPublisherError(
                'O container do Instagram não ficou pronto no tempo esperado.',
                'INSTAGRAM_CONTAINER_STATUS_TIMEOUT'
            );
        }

        const published = await postForm(
            'https://graph.instagram.com/v24.0/me/media_publish',
            {
                creation_id: containerId,
                access_token: accessToken
            },
            'Instagram'
        );

        if (!published || !published.id) {
            throw new MetaPublisherError(
                'Instagram não retornou o identificador da mídia.',
                'INSTAGRAM_MEDIA_ID_MISSING'
            );
        }

        return {
            success: true,
            mediaId: String(published.id)
        };
    }

    async function publishFacebook({ imageUrl, caption = '' }) {
        const accessToken = env.FACEBOOK_PAGE_ACCESS_TOKEN;
        const pageId = env.FACEBOOK_PAGE_ID;

        if (!accessToken) {
            throw new MetaPublisherError(
                'Credencial da página do Facebook não configurada.',
                'FACEBOOK_CREDENTIAL_MISSING'
            );
        }

        if (!pageId) {
            throw new MetaPublisherError(
                'Identificador da página do Facebook não configurado.',
                'FACEBOOK_PAGE_ID_MISSING'
            );
        }

        const published = await postForm(
            `https://graph.facebook.com/v25.0/${encodeURIComponent(pageId)}/photos`,
            {
                url: imageUrl,
                caption,
                access_token: accessToken
            },
            'Facebook'
        );

        const photoId = published && published.id
            ? String(published.id)
            : null;
        const postId = published && published.post_id
            ? String(published.post_id)
            : null;

        if (!photoId && !postId) {
            throw new MetaPublisherError(
                'Facebook não retornou um identificador da publicação.',
                'FACEBOOK_PUBLICATION_ID_MISSING'
            );
        }

        return {
            success: true,
            photoId,
            postId
        };
    }

    async function publishToChannels({ imageUrl, caption = '', channels }) {
        if (!Array.isArray(channels) || channels.length === 0) {
            throw new MetaPublisherError(
                'Informe pelo menos um canal.',
                'CHANNELS_REQUIRED'
            );
        }

        const uniqueChannels = [...new Set(channels)];
        const invalidChannel = uniqueChannels.find(
            channel => !SUPPORTED_CHANNELS.has(channel)
        );

        if (invalidChannel) {
            throw new MetaPublisherError(
                'Canal de publicação inválido.',
                'INVALID_CHANNEL'
            );
        }

        const results = await Promise.all(
            uniqueChannels.map(async channel => {
                try {
                    const result = channel === 'instagram'
                        ? await publishInstagram({ imageUrl, caption })
                        : await publishFacebook({ imageUrl, caption });

                    return [channel, result];
                } catch (error) {
                    return [
                        channel,
                        {
                            success: false,
                            error: {
                                code: error && error.code
                                    ? error.code
                                    : 'META_PUBLICATION_ERROR',
                                message: error && error.message
                                    ? error.message
                                    : `Falha ao publicar no ${channel}.`
                            }
                        }
                    ];
                }
            })
        );

        const channelResults = Object.fromEntries(results);

        return {
            success: Object.values(channelResults).every(
                result => result.success
            ),
            channels: channelResults
        };
    }

    return {
        publishInstagram,
        publishFacebook,
        publishToChannels
    };
}


module.exports = {
    MetaPublisherError,
    createMetaPublisher
};

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createMetaPublisher
} = require('../marketing/meta-publisher');


function response(body, options = {}) {
    return {
        ok: options.ok !== false,
        status: options.status || 200,
        async json() {
            if (options.invalidJson) {
                throw new SyntaxError('invalid json');
            }

            return body;
        }
    };
}


function configuredEnv() {
    return {
        INSTAGRAM_ACCESS_TOKEN: 'private-instagram-value',
        FACEBOOK_PAGE_ACCESS_TOKEN: 'private-facebook-value',
        FACEBOOK_PAGE_ID: 'page-id'
    };
}


test('publica no Instagram quando o container já está FINISHED', async () => {
    const calls = [];
    const publisher = createMetaPublisher({
        env: configuredEnv(),
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            if (calls.length === 1) {
                return response({ id: 'container-id' });
            }

            if (calls.length === 2) {
                return response({ status_code: 'FINISHED' });
            }

            return response({ id: 'media-id' });
        }
    });

    const result = await publisher.publishInstagram({
        imageUrl: 'https://example.com/image.jpg',
        caption: 'Legenda'
    });

    assert.deepEqual(result, { success: true, mediaId: 'media-id' });
    assert.equal(calls.length, 3);
    assert.match(calls[0].url, /\/media$/);
    assert.equal(calls[1].options.method, 'GET');
    assert.match(calls[1].url, /\/container-id\?/);
    assert.match(calls[2].url, /\/media_publish$/);
    assert.equal(calls[2].options.body.get('creation_id'), 'container-id');
});


test('aguarda IN_PROGRESS e publica depois de FINISHED', async () => {
    const statuses = ['IN_PROGRESS', 'FINISHED'];
    const sleeps = [];
    const publisher = createMetaPublisher({
        env: configuredEnv(),
        sleepImpl: async delayMs => sleeps.push(delayMs),
        fetchImpl: async (url, options) => {
            if (url.endsWith('/me/media')) {
                return response({ id: 'container-id' });
            }

            if (options.method === 'GET') {
                return response({ status_code: statuses.shift() });
            }

            return response({ id: 'media-id' });
        }
    });

    const result = await publisher.publishInstagram({
        imageUrl: 'https://example.com/image.jpg',
        caption: 'Legenda'
    });

    assert.equal(result.mediaId, 'media-id');
    assert.deepEqual(sleeps, [1000]);
});


test('aborta quando o container retorna ERROR', async () => {
    const env = configuredEnv();
    const publisher = createMetaPublisher({
        env,
        sleepImpl: async () => {},
        fetchImpl: async (url, options) => {
            if (url.endsWith('/me/media')) {
                return response({ id: 'container-id' });
            }

            if (options.method === 'GET') {
                return response({
                    status_code: 'ERROR',
                    status: env.INSTAGRAM_ACCESS_TOKEN
                });
            }

            return response({ id: 'unused' });
        }
    });

    const result = await publisher.publishToChannels({
        imageUrl: 'https://example.com/image.jpg',
        caption: '',
        channels: ['instagram']
    });

    assert.equal(
        result.channels.instagram.error.code,
        'INSTAGRAM_CONTAINER_FAILED'
    );
    assert.doesNotMatch(
        JSON.stringify(result),
        /private-instagram-value/
    );
});


test('retorna timeout após o limite esperando FINISHED', async () => {
    let statusChecks = 0;
    let sleeps = 0;
    const publisher = createMetaPublisher({
        env: configuredEnv(),
        sleepImpl: async () => {
            sleeps += 1;
        },
        fetchImpl: async (url, options) => {
            if (url.endsWith('/me/media')) {
                return response({ id: 'container-id' });
            }

            if (options.method === 'GET') {
                statusChecks += 1;
                return response({ status_code: 'IN_PROGRESS' });
            }

            return response({ id: 'unused' });
        }
    });

    const result = await publisher.publishToChannels({
        imageUrl: 'https://example.com/image.jpg',
        caption: '',
        channels: ['instagram']
    });

    assert.equal(statusChecks, 10);
    assert.equal(sleeps, 9);
    assert.equal(
        result.channels.instagram.error.code,
        'INSTAGRAM_CONTAINER_STATUS_TIMEOUT'
    );
});


test('publica foto no Facebook e retorna photoId e postId', async () => {
    const publisher = createMetaPublisher({
        env: configuredEnv(),
        fetchImpl: async () => response({
            id: 'photo-id',
            post_id: 'post-id'
        })
    });

    const result = await publisher.publishFacebook({
        imageUrl: 'https://example.com/image.jpg',
        caption: 'Legenda'
    });

    assert.deepEqual(result, {
        success: true,
        photoId: 'photo-id',
        postId: 'post-id'
    });
});


test('publica nos dois canais', async () => {
    const publisher = createMetaPublisher({
        env: configuredEnv(),
        fetchImpl: async (url, options) => {
            if (url.endsWith('/me/media')) {
                return response({ id: 'container-id' });
            }

            if (url.includes('instagram') && options.method === 'GET') {
                return response({ status_code: 'FINISHED' });
            }

            if (url.endsWith('/media_publish')) {
                return response({ id: 'media-id' });
            }

            return response({ id: 'photo-id' });
        }
    });

    const result = await publisher.publishToChannels({
        imageUrl: 'https://example.com/image.jpg',
        caption: 'Legenda',
        channels: ['instagram', 'facebook']
    });

    assert.equal(result.success, true);
    assert.equal(result.channels.instagram.mediaId, 'media-id');
    assert.equal(result.channels.facebook.photoId, 'photo-id');
});


test('isola falha de um canal e preserva sucesso do outro', async () => {
    const publisher = createMetaPublisher({
        env: configuredEnv(),
        fetchImpl: async url => url.includes('instagram')
            ? response({}, { ok: false, status: 500 })
            : response({ id: 'photo-id' })
    });

    const result = await publisher.publishToChannels({
        imageUrl: 'https://example.com/image.jpg',
        caption: 'Legenda',
        channels: ['instagram', 'facebook']
    });

    assert.equal(result.success, false);
    assert.equal(result.channels.instagram.success, false);
    assert.equal(result.channels.facebook.success, true);
});


test('informa credencial ausente por canal', async () => {
    const publisher = createMetaPublisher({
        env: {},
        fetchImpl: async () => response({ id: 'unused' })
    });

    const result = await publisher.publishToChannels({
        imageUrl: 'https://example.com/image.jpg',
        caption: '',
        channels: ['instagram']
    });

    assert.equal(
        result.channels.instagram.error.code,
        'INSTAGRAM_CREDENTIAL_MISSING'
    );
});


test('informa page id ausente', async () => {
    const env = configuredEnv();
    delete env.FACEBOOK_PAGE_ID;
    const publisher = createMetaPublisher({
        env,
        fetchImpl: async () => response({ id: 'unused' })
    });

    const result = await publisher.publishToChannels({
        imageUrl: 'https://example.com/image.jpg',
        caption: '',
        channels: ['facebook']
    });

    assert.equal(
        result.channels.facebook.error.code,
        'FACEBOOK_PAGE_ID_MISSING'
    );
});


test('trata HTTP 4xx e 5xx sem reproduzir o corpo da Meta', async () => {
    const publisher = createMetaPublisher({
        env: configuredEnv(),
        fetchImpl: async () => response(
            { error: { message: 'private-facebook-value' } },
            { ok: false, status: 401 }
        )
    });

    const result = await publisher.publishToChannels({
        imageUrl: 'https://example.com/image.jpg',
        caption: '',
        channels: ['facebook']
    });

    assert.equal(result.channels.facebook.error.code, 'META_HTTP_ERROR');
    assert.doesNotMatch(
        result.channels.facebook.error.message,
        /private-facebook-value/
    );
});


test('trata JSON inválido', async () => {
    const publisher = createMetaPublisher({
        env: configuredEnv(),
        fetchImpl: async () => response(null, { invalidJson: true })
    });

    const result = await publisher.publishToChannels({
        imageUrl: 'https://example.com/image.jpg',
        caption: '',
        channels: ['facebook']
    });

    assert.equal(
        result.channels.facebook.error.code,
        'META_INVALID_RESPONSE'
    );
});


test('nunca inclui credenciais em mensagens de erro de rede', async () => {
    const env = configuredEnv();
    const publisher = createMetaPublisher({
        env,
        fetchImpl: async () => {
            throw new Error(env.INSTAGRAM_ACCESS_TOKEN);
        }
    });

    const result = await publisher.publishToChannels({
        imageUrl: 'https://example.com/image.jpg',
        caption: '',
        channels: ['instagram']
    });
    const serialized = JSON.stringify(result);

    assert.doesNotMatch(serialized, /private-instagram-value/);
});


test('rejeita channel inválido', async () => {
    const publisher = createMetaPublisher({
        env: configuredEnv(),
        fetchImpl: async () => response({ id: 'unused' })
    });

    await assert.rejects(
        publisher.publishToChannels({
            imageUrl: 'https://example.com/image.jpg',
            caption: '',
            channels: ['tiktok']
        }),
        error => error.code === 'INVALID_CHANNEL'
    );
});

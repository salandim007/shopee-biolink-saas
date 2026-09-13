'use strict';

const express =
    require('express');

const crypto =
    require('crypto');

const fs =
    require('node:fs');

const path =
    require('node:path');

const router =
    express.Router();

const PUBLIC_BASE_URL =
    String(
        process.env.MARKETING_PUBLIC_BASE_URL ||
        'https://mixdeproduto.com'
    ).replace(/\/+$/, '');

const TTL_SECONDS =
    60 * 60;

const MAX_IMAGE_BYTES =
    15 * 1024 * 1024;


function getSecret() {
    const secret =
        String(
            process.env.META_MEDIA_SIGNING_SECRET ||
            ''
        ).trim();

    if (!secret) {
        throw new Error(
            'META_MEDIA_SIGNING_SECRET não configurado.'
        );
    }

    return secret;
}


function isAllowedShopeeImageUrl(
    value
) {
    try {
        const url =
            new URL(
                String(value || '')
            );

        const hostname =
            url.hostname
                .toLowerCase();

        return (
            url.protocol === 'https:' &&
            (
                hostname ===
                    'img.susercontent.com' ||
                hostname.endsWith(
                    '.img.susercontent.com'
                )
            )
        );

    } catch (_) {
        return false;
    }
}


function signatureFor(
    sourceUrl,
    expires
) {
    return crypto
        .createHmac(
            'sha256',
            getSecret()
        )
        .update(
            `${expires}\n${sourceUrl}`
        )
        .digest('hex');
}


function buildSignedMetaImageUrl(
    sourceUrl
) {
    sourceUrl =
        String(
            sourceUrl || ''
        ).trim();

    if (
        !isAllowedShopeeImageUrl(
            sourceUrl
        )
    ) {
        return sourceUrl;
    }

    const expires =
        Math.floor(
            Date.now() / 1000
        ) +
        TTL_SECONDS;

    const signature =
        signatureFor(
            sourceUrl,
            expires
        );

    const url =
        new URL(
            '/media/meta/image',
            PUBLIC_BASE_URL
        );

    url.searchParams.set(
        'url',
        sourceUrl
    );

    url.searchParams.set(
        'exp',
        String(expires)
    );

    url.searchParams.set(
        'sig',
        signature
    );

    return url.toString();
}


function verifyRequest(
    sourceUrl,
    expires,
    signature
) {
    if (
        !isAllowedShopeeImageUrl(
            sourceUrl
        )
    ) {
        return false;
    }

    const exp =
        Number(expires);

    const now =
        Math.floor(
            Date.now() / 1000
        );

    if (
        !Number.isInteger(exp) ||
        exp < now ||
        exp > now + TTL_SECONDS + 300
    ) {
        return false;
    }

    const expected =
        signatureFor(
            sourceUrl,
            exp
        );

    if (
        !/^[a-f0-9]{64}$/i.test(
            String(signature || '')
        )
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(
            expected,
            'hex'
        ),
        Buffer.from(
            signature,
            'hex'
        )
    );
}


function buildSignedMetaReelUrl(
    sourceUrl
) {
    const value =
        String(
            sourceUrl || ''
        ).trim();

    let parsed;

    try {
        parsed =
            new URL(value);
    } catch {
        return value;
    }

    const match =
        parsed.pathname.match(
            /^\/admin\/vitrine2\/marketing\/media\/reel\/([a-zA-Z0-9_-]+)$/
        );

    if (!match) {
        return value;
    }

    const jobId =
        match[1];

    const expires =
        Math.floor(
            Date.now() / 1000
        ) +
        TTL_SECONDS;

    const signature =
        signatureFor(
            `reel:${jobId}`,
            expires
        );

    const url =
        new URL(
            `/media/meta/reel/${encodeURIComponent(jobId)}`,
            PUBLIC_BASE_URL
        );

    url.searchParams.set(
        'exp',
        String(expires)
    );

    url.searchParams.set(
        'sig',
        signature
    );

    return url.toString();
}


function verifySignedReel(
    jobId,
    expires,
    signature
) {
    const exp =
        Number(expires);

    const now =
        Math.floor(
            Date.now() / 1000
        );

    if (
        !/^[a-zA-Z0-9_-]+$/.test(jobId) ||
        !Number.isInteger(exp) ||
        exp < now ||
        exp > now + TTL_SECONDS + 300
    ) {
        return false;
    }

    if (
        !/^[a-f0-9]{64}$/i.test(
            String(signature || '')
        )
    ) {
        return false;
    }

    const expected =
        signatureFor(
            `reel:${jobId}`,
            exp
        );

    return crypto.timingSafeEqual(
        Buffer.from(
            expected,
            'hex'
        ),
        Buffer.from(
            signature,
            'hex'
        )
    );
}


router.get(
    '/image',
    async (req, res) => {

        const sourceUrl =
            String(
                req.query.url ||
                ''
            ).trim();

        const expires =
            req.query.exp;

        const signature =
            String(
                req.query.sig ||
                ''
            );


        try {

            if (
                !verifyRequest(
                    sourceUrl,
                    expires,
                    signature
                )
            ) {
                return res
                    .status(403)
                    .send(
                        'Media URL inválida ou expirada.'
                    );
            }


            const response =
                await fetch(
                    sourceUrl,
                    {
                        redirect:
                            'follow',

                        headers: {
                            'User-Agent':
                                'Mozilla/5.0',

                            'Accept':
                                'image/*,*/*;q=0.8'
                        }
                    }
                );


            if (!response.ok) {
                return res
                    .status(502)
                    .send(
                        'Falha ao obter imagem.'
                    );
            }


            const contentType =
                String(
                    response.headers
                        .get(
                            'content-type'
                        ) ||
                    ''
                )
                    .split(';')[0]
                    .trim()
                    .toLowerCase();


            if (
                !contentType.startsWith(
                    'image/'
                )
            ) {
                return res
                    .status(502)
                    .send(
                        'Conteúdo recebido não é imagem.'
                    );
            }


            const buffer =
                Buffer.from(
                    await response
                        .arrayBuffer()
                );


            if (
                buffer.length >
                MAX_IMAGE_BYTES
            ) {
                return res
                    .status(413)
                    .send(
                        'Imagem excede o limite.'
                    );
            }


            res.set({
                'Content-Type':
                    contentType,

                'Content-Length':
                    String(
                        buffer.length
                    ),

                'Cache-Control':
                    'public, max-age=300'
            });


            return res.send(
                buffer
            );

        } catch (error) {

            console.error(
                '[META MEDIA] Falha:',
                error?.message ||
                error
            );

            return res
                .status(500)
                .send(
                    'Falha ao servir mídia.'
                );
        }
    }
);


router.get(
    '/reel/:jobId',
    (req, res) => {
        const jobId =
            String(
                req.params.jobId ||
                ''
            ).trim();

        const expires =
            req.query.exp;

        const signature =
            String(
                req.query.sig ||
                ''
            );

        if (
            !verifySignedReel(
                jobId,
                expires,
                signature
            )
        ) {
            return res
                .status(403)
                .send(
                    'Media URL inválida ou expirada.'
                );
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
            return res
                .status(404)
                .send(
                    'Reel não encontrado.'
                );
        }

        res.set({
            'Content-Type':
                'video/mp4',

            'Cache-Control':
                'public, max-age=300',

            'Accept-Ranges':
                'bytes'
        });

        return res.sendFile(
            reelPath
        );
    }
);


module.exports = {
    metaMediaPublicRouter:
        router,

    buildSignedMetaImageUrl,
    buildSignedMetaReelUrl
};

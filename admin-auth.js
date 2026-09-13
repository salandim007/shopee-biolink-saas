'use strict';

const crypto = require('crypto');

const ADMIN_REALM =
    'Mix de Produtos - Admin';


function safeEqual(valueA, valueB) {

    const bufferA =
        Buffer.from(
            String(valueA || ''),
            'utf8'
        );

    const bufferB =
        Buffer.from(
            String(valueB || ''),
            'utf8'
        );

    if (
        bufferA.length !==
        bufferB.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        bufferA,
        bufferB
    );
}


function requestLogin(res) {

    res.set(
        'WWW-Authenticate',
        `Basic realm="${ADMIN_REALM}", charset="UTF-8"`
    );

    res.set(
        'Cache-Control',
        'no-store'
    );

    return res
        .status(401)
        .send(
            'Acesso restrito.'
        );
}


function requireAdminAuth(
    req,
    res,
    next
) {

    const expectedUser =
        process.env.ADMIN_AUTH_USER;

    const expectedPassword =
        process.env.ADMIN_AUTH_PASSWORD;


    /*
     * Se as credenciais sumirem,
     * o Admin permanece FECHADO.
     */
    if (
        !expectedUser ||
        !expectedPassword
    ) {

        console.error(
            '[SEGURANÇA] Credenciais administrativas ausentes.'
        );

        return res
            .status(503)
            .send(
                'Área administrativa temporariamente indisponível.'
            );
    }


    const authorization =
        String(
            req.headers.authorization ||
            ''
        );


    if (
        !authorization.startsWith(
            'Basic '
        )
    ) {
        return requestLogin(
            res
        );
    }


    let decoded;

    try {

        decoded =
            Buffer
                .from(
                    authorization.slice(6),
                    'base64'
                )
                .toString(
                    'utf8'
                );

    } catch (error) {

        return requestLogin(
            res
        );
    }


    const separator =
        decoded.indexOf(
            ':'
        );


    if (
        separator < 0
    ) {
        return requestLogin(
            res
        );
    }


    const receivedUser =
        decoded.slice(
            0,
            separator
        );

    const receivedPassword =
        decoded.slice(
            separator + 1
        );


    if (
        !safeEqual(
            receivedUser,
            expectedUser
        ) ||
        !safeEqual(
            receivedPassword,
            expectedPassword
        )
    ) {
        return requestLogin(
            res
        );
    }


    next();
}


/*
 * API da Vitrine:
 *
 * Público:
 * GET /products/published
 *
 * Todo o restante:
 * somente Admin.
 */
function requireVitrine2ApiAuth(
    req,
    res,
    next
) {

    const publicProducts =
        req.method === 'GET' &&
        req.path ===
            '/products/published';


    if (
        publicProducts
    ) {
        return next();
    }


    return requireAdminAuth(
        req,
        res,
        next
    );
}


module.exports = {
    requireAdminAuth,
    requireVitrine2ApiAuth
};

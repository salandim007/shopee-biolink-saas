'use strict';

const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();


const databasePath =
    path.join(
        __dirname,
        '..',
        'database.sqlite'
    );


const db =
    new sqlite3.Database(
        databasePath
    );


function run(sql, params = []) {
    return new Promise(
        (resolve, reject) => {
            db.run(
                sql,
                params,
                function callback(error) {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        changes:
                            this.changes,

                        lastID:
                            this.lastID
                    });
                }
            );
        }
    );
}


function get(sql, params = []) {
    return new Promise(
        (resolve, reject) => {
            db.get(
                sql,
                params,
                (error, row) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        row || null
                    );
                }
            );
        }
    );
}


function all(sql, params = []) {
    return new Promise(
        (resolve, reject) => {
            db.all(
                sql,
                params,
                (error, rows) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        Array.isArray(rows)
                            ? rows
                            : []
                    );
                }
            );
        }
    );
}


async function initialize() {
    /*
     * Pessoa que demonstrou intenção.
     *
     * Não significa autorização irrestrita
     * para mensagens futuras.
     * É apenas nosso registro de relacionamento.
     */
    await run(`
        CREATE TABLE IF NOT EXISTS marketing_leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            platform TEXT NOT NULL,
            external_user_id TEXT NOT NULL,
            username TEXT,

            status TEXT NOT NULL
                DEFAULT 'INTERESTED',

            total_requests INTEGER NOT NULL
                DEFAULT 0,

            first_seen_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            last_seen_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            created_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            UNIQUE (
                platform,
                external_user_id
            )
        )
    `);


    /*
     * Cada comentário "EU QUERO".
     *
     * comment_id é único:
     * o mesmo comentário nunca poderá
     * disparar o link duas vezes.
     */
    await run(`
        CREATE TABLE IF NOT EXISTS marketing_lead_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            platform TEXT NOT NULL,

            comment_id TEXT NOT NULL,
            media_id TEXT NOT NULL,

            external_user_id TEXT NOT NULL,
            username TEXT,

            marketplace TEXT,
            item_id TEXT,
            format TEXT,

            comment_text TEXT,
            trigger_keyword TEXT,

            affiliate_link TEXT,

            status TEXT NOT NULL
                DEFAULT 'RECEIVED',

            received_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            link_sent_at TEXT,

            error_code TEXT,
            error_message TEXT,

            created_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            UNIQUE (
                platform,
                comment_id
            )
        )
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
            idx_marketing_lead_requests_media
        ON marketing_lead_requests (
            platform,
            media_id
        )
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
            idx_marketing_lead_requests_product
        ON marketing_lead_requests (
            marketplace,
            item_id
        )
    `);


    await run(`
        CREATE INDEX IF NOT EXISTS
            idx_marketing_lead_requests_user
        ON marketing_lead_requests (
            platform,
            external_user_id
        )
    `);
}


const ready =
    initialize();


async function getLead({
    platform,
    externalUserId
}) {
    await ready;

    return get(
        `
            SELECT
                id,
                platform,
                external_user_id AS externalUserId,
                username,
                status,
                total_requests AS totalRequests,
                first_seen_at AS firstSeenAt,
                last_seen_at AS lastSeenAt,
                created_at AS createdAt,
                updated_at AS updatedAt
            FROM marketing_leads
            WHERE platform = ?
              AND external_user_id = ?
            LIMIT 1
        `,
        [
            String(platform),
            String(externalUserId)
        ]
    );
}


async function getRequestByCommentId({
    platform,
    commentId
}) {
    await ready;

    return get(
        `
            SELECT
                id,
                platform,
                comment_id AS commentId,
                media_id AS mediaId,
                external_user_id AS externalUserId,
                username,
                marketplace,
                item_id AS itemId,
                format,
                comment_text AS commentText,
                trigger_keyword AS triggerKeyword,
                affiliate_link AS affiliateLink,
                status,
                received_at AS receivedAt,
                link_sent_at AS linkSentAt,
                error_code AS errorCode,
                error_message AS errorMessage,
                created_at AS createdAt,
                updated_at AS updatedAt
            FROM marketing_lead_requests
            WHERE platform = ?
              AND comment_id = ?
            LIMIT 1
        `,
        [
            String(platform),
            String(commentId)
        ]
    );
}


async function registerRequest({
    platform = 'instagram',
    commentId,
    mediaId,
    externalUserId,
    username = null,
    marketplace = null,
    itemId = null,
    format = null,
    commentText = null,
    triggerKeyword = 'EU QUERO'
}) {
    await ready;

    const normalizedPlatform =
        String(platform)
            .trim()
            .toLowerCase();

    const normalizedCommentId =
        String(commentId || '')
            .trim();

    const normalizedMediaId =
        String(mediaId || '')
            .trim();

    const normalizedUserId =
        String(externalUserId || '')
            .trim();


    if (
        !normalizedCommentId ||
        !normalizedMediaId ||
        !normalizedUserId
    ) {
        throw new Error(
            'commentId, mediaId e externalUserId são obrigatórios.'
        );
    }


    const inserted =
        await run(
            `
                INSERT OR IGNORE INTO marketing_lead_requests (
                    platform,
                    comment_id,
                    media_id,
                    external_user_id,
                    username,
                    marketplace,
                    item_id,
                    format,
                    comment_text,
                    trigger_keyword,
                    status,
                    updated_at
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    'RECEIVED',
                    CURRENT_TIMESTAMP
                )
            `,
            [
                normalizedPlatform,
                normalizedCommentId,
                normalizedMediaId,
                normalizedUserId,
                username
                    ? String(username)
                    : null,
                marketplace
                    ? String(marketplace)
                    : null,
                itemId
                    ? String(itemId)
                    : null,
                format
                    ? String(format)
                    : null,
                commentText
                    ? String(commentText)
                    : null,
                triggerKeyword
                    ? String(triggerKeyword)
                    : null
            ]
        );


    /*
     * Comentário já registrado:
     * NÃO incrementa lead e NÃO poderá
     * disparar nova mensagem.
     */
    if (inserted.changes === 0) {
        return {
            created:
                false,

            duplicate:
                true,

            request:
                await getRequestByCommentId({
                    platform:
                        normalizedPlatform,

                    commentId:
                        normalizedCommentId
                })
        };
    }


    await run(
        `
            INSERT INTO marketing_leads (
                platform,
                external_user_id,
                username,
                total_requests,
                last_seen_at,
                updated_at
            )
            VALUES (
                ?, ?, ?, 1,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )

            ON CONFLICT (
                platform,
                external_user_id
            )
            DO UPDATE SET
                username =
                    COALESCE(
                        excluded.username,
                        marketing_leads.username
                    ),

                total_requests =
                    marketing_leads.total_requests + 1,

                last_seen_at =
                    CURRENT_TIMESTAMP,

                updated_at =
                    CURRENT_TIMESTAMP
        `,
        [
            normalizedPlatform,
            normalizedUserId,
            username
                ? String(username)
                : null
        ]
    );


    return {
        created:
            true,

        duplicate:
            false,

        request:
            await getRequestByCommentId({
                platform:
                    normalizedPlatform,

                commentId:
                    normalizedCommentId
            }),

        lead:
            await getLead({
                platform:
                    normalizedPlatform,

                externalUserId:
                    normalizedUserId
            })
    };
}


async function markLinkSent({
    platform = 'instagram',
    commentId,
    affiliateLink
}) {
    await ready;

    await run(
        `
            UPDATE marketing_lead_requests
            SET
                status = 'LINK_SENT',
                affiliate_link = ?,
                link_sent_at = CURRENT_TIMESTAMP,
                error_code = NULL,
                error_message = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE platform = ?
              AND comment_id = ?
        `,
        [
            String(
                affiliateLink || ''
            ),

            String(platform),
            String(commentId)
        ]
    );

    return getRequestByCommentId({
        platform,
        commentId
    });
}


async function markFailed({
    platform = 'instagram',
    commentId,
    errorCode = null,
    errorMessage = null
}) {
    await ready;

    await run(
        `
            UPDATE marketing_lead_requests
            SET
                status = 'FAILED',
                error_code = ?,
                error_message = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE platform = ?
              AND comment_id = ?
        `,
        [
            errorCode
                ? String(errorCode)
                : null,

            errorMessage
                ? String(errorMessage)
                : null,

            String(platform),
            String(commentId)
        ]
    );

    return getRequestByCommentId({
        platform,
        commentId
    });
}


async function listLeadRequests({
    platform,
    externalUserId
}) {
    await ready;

    return all(
        `
            SELECT
                comment_id AS commentId,
                media_id AS mediaId,
                marketplace,
                item_id AS itemId,
                format,
                comment_text AS commentText,
                affiliate_link AS affiliateLink,
                status,
                received_at AS receivedAt,
                link_sent_at AS linkSentAt
            FROM marketing_lead_requests
            WHERE platform = ?
              AND external_user_id = ?
            ORDER BY received_at DESC
        `,
        [
            String(platform),
            String(externalUserId)
        ]
    );
}


module.exports = {
    ready,
    getLead,
    getRequestByCommentId,
    registerRequest,
    markLinkSent,
    markFailed,
    listLeadRequests
};

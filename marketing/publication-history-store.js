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
    await run(`
        CREATE TABLE IF NOT EXISTS marketing_publications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            marketplace TEXT NOT NULL,
            item_id TEXT NOT NULL,
            channel TEXT NOT NULL,
            format TEXT NOT NULL,

            status TEXT NOT NULL,

            media_id TEXT,

            published_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

            UNIQUE (
                marketplace,
                item_id,
                channel,
                format
            )
        )
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
            idx_marketing_publications_product
        ON marketing_publications (
            marketplace,
            item_id
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS marketing_publication_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            marketplace TEXT NOT NULL,
            item_id TEXT NOT NULL,
            channel TEXT NOT NULL,
            format TEXT NOT NULL,

            status TEXT NOT NULL,

            media_id TEXT,
            external_post_id TEXT,

            published_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
            idx_marketing_publication_events_product
        ON marketing_publication_events (
            marketplace,
            item_id,
            published_at
        )
    `);
}


const ready =
    initialize();


async function getPublication({
    marketplace = 'shopee',
    itemId,
    channel,
    format
}) {
    await ready;

    return get(
        `
            SELECT
                marketplace,
                item_id AS itemId,
                channel,
                format,
                status,
                media_id AS mediaId,
                published_at AS publishedAt,
                created_at AS createdAt,
                updated_at AS updatedAt
            FROM marketing_publications
            WHERE marketplace = ?
              AND item_id = ?
              AND channel = ?
              AND format = ?
            LIMIT 1
        `,
        [
            marketplace,
            String(itemId),
            channel,
            format
        ]
    );
}


async function listProductPublications({
    marketplace = 'shopee',
    itemId
}) {
    await ready;

    return all(
        `
            SELECT
                marketplace,
                item_id AS itemId,
                channel,
                format,
                status,
                media_id AS mediaId,
                published_at AS publishedAt,
                created_at AS createdAt,
                updated_at AS updatedAt
            FROM marketing_publications
            WHERE marketplace = ?
              AND item_id = ?
            ORDER BY published_at DESC,
                     updated_at DESC
        `,
        [
            marketplace,
            String(itemId)
        ]
    );
}


async function getProductPublicationStats({
    marketplace = 'shopee',
    itemId
}) {
    await ready;

    const normalizedItemId =
        String(itemId || '').trim();

    if (!normalizedItemId) {
        throw new Error(
            'itemId é obrigatório.'
        );
    }

    const totalRow =
        await get(
            `
                SELECT
                    COUNT(*) AS total,
                    MAX(published_at) AS lastPublishedAt
                FROM marketing_publication_events
                WHERE marketplace = ?
                  AND item_id = ?
                  AND status = 'PUBLISHED'
            `,
            [
                marketplace,
                normalizedItemId
            ]
        );

    const channelRows =
        await all(
            `
                SELECT
                    channel,
                    COUNT(*) AS total,
                    MAX(published_at) AS lastPublishedAt
                FROM marketing_publication_events
                WHERE marketplace = ?
                  AND item_id = ?
                  AND status = 'PUBLISHED'
                GROUP BY channel
                ORDER BY total DESC
            `,
            [
                marketplace,
                normalizedItemId
            ]
        );

    const formatRows =
        await all(
            `
                SELECT
                    channel,
                    format,
                    COUNT(*) AS total,
                    MAX(published_at) AS lastPublishedAt
                FROM marketing_publication_events
                WHERE marketplace = ?
                  AND item_id = ?
                  AND status = 'PUBLISHED'
                GROUP BY channel, format
                ORDER BY channel, total DESC
            `,
            [
                marketplace,
                normalizedItemId
            ]
        );

    const byChannel = {};

    for (const row of channelRows) {
        byChannel[row.channel] = {
            total:
                Number(row.total || 0),

            lastPublishedAt:
                row.lastPublishedAt || null
        };
    }

    return {
        total:
            Number(
                totalRow?.total || 0
            ),

        lastPublishedAt:
            totalRow?.lastPublishedAt || null,

        byChannel,

        formats:
            formatRows.map(
                row => ({
                    channel:
                        row.channel,

                    format:
                        row.format,

                    total:
                        Number(
                            row.total || 0
                        ),

                    lastPublishedAt:
                        row.lastPublishedAt || null
                })
            )
    };
}


async function beginPublication({
    marketplace = 'shopee',
    itemId,
    channel,
    format
}) {
    await ready;

    const result =
        await run(
            `
                INSERT INTO marketing_publications (
                    marketplace,
                    item_id,
                    channel,
                    format,
                    status,
                    updated_at
                )
                VALUES (?, ?, ?, ?, 'PROCESSING', CURRENT_TIMESTAMP)

                ON CONFLICT (
                    marketplace,
                    item_id,
                    channel,
                    format
                )
                DO UPDATE SET
                    status = 'PROCESSING',
                    updated_at = CURRENT_TIMESTAMP

                WHERE marketing_publications.status = 'FAILED'
            `,
            [
                marketplace,
                String(itemId),
                channel,
                format
            ]
        );

    if (result.changes === 0) {
        return {
            allowed: false,

            publication:
                await getPublication({
                    marketplace,
                    itemId,
                    channel,
                    format
                })
        };
    }

    return {
        allowed: true,

        publication:
            await getPublication({
                marketplace,
                itemId,
                channel,
                format
            })
    };
}


async function markPublished({
    marketplace = 'shopee',
    itemId,
    channel,
    format,
    mediaId = null
}) {
    await ready;

    const updateResult =
        await run(
            `
                UPDATE marketing_publications
                SET
                    status = 'PUBLISHED',
                    media_id = ?,
                    published_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE marketplace = ?
                  AND item_id = ?
                  AND channel = ?
                  AND format = ?
            `,
            [
                mediaId
                    ? String(mediaId)
                    : null,

                marketplace,
                String(itemId),
                channel,
                format
            ]
        );

    if (updateResult.changes > 0) {
        await run(
            `
                INSERT INTO marketing_publication_events (
                    marketplace,
                    item_id,
                    channel,
                    format,
                    status,
                    media_id,
                    published_at
                )
                VALUES (
                    ?, ?, ?, ?, 'PUBLISHED', ?,
                    CURRENT_TIMESTAMP
                )
            `,
            [
                marketplace,
                String(itemId),
                channel,
                format,
                mediaId
                    ? String(mediaId)
                    : null
            ]
        );
    }

    return getPublication({
        marketplace,
        itemId,
        channel,
        format
    });
}


async function markFailed({
    marketplace = 'shopee',
    itemId,
    channel,
    format
}) {
    await ready;

    await run(
        `
            UPDATE marketing_publications
            SET
                status = 'FAILED',
                updated_at = CURRENT_TIMESTAMP
            WHERE marketplace = ?
              AND item_id = ?
              AND channel = ?
              AND format = ?
        `,
        [
            marketplace,
            String(itemId),
            channel,
            format
        ]
    );
}


async function getPublicationByMediaId({
    channel = 'instagram',
    mediaId
}) {
    await ready;

    const normalizedChannel =
        String(
            channel || ''
        )
            .trim()
            .toLowerCase();

    const normalizedMediaId =
        String(
            mediaId || ''
        ).trim();


    if (
        !normalizedChannel ||
        !normalizedMediaId
    ) {
        return null;
    }


    return get(
        `
            SELECT
                marketplace,
                item_id AS itemId,
                channel,
                format,
                status,
                media_id AS mediaId,
                published_at AS publishedAt,
                created_at AS createdAt,
                updated_at AS updatedAt
            FROM marketing_publications
            WHERE channel = ?
              AND media_id = ?
              AND status = 'PUBLISHED'
            ORDER BY published_at DESC
            LIMIT 1
        `,
        [
            normalizedChannel,
            normalizedMediaId
        ]
    );
}


module.exports = {
    ready,
    getPublication,
    getPublicationByMediaId,
    listProductPublications,
    getProductPublicationStats,
    beginPublication,
    markPublished,
    markFailed
};

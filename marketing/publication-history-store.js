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


module.exports = {
    ready,
    getPublication,
    listProductPublications,
    beginPublication,
    markPublished,
    markFailed
};

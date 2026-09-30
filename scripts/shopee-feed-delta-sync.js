'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');

const API = 'https://open-api.affiliate.shopee.com.br/graphql';
const REFERENCE_ID = '428536169534861312';

const ROOT = '/app/data/shopee-feed-api';
const DB = path.join(ROOT, 'index/catalog.sqlite');
const CHECKPOINT = path.join(ROOT, 'checkpoints/delta-official.json');
const UNKNOWN_LOG = path.join(ROOT, 'logs/delta-unknown.jsonl');

const LIMIT = 500;
const MAX_PAGES = Number(process.env.DELTA_MAX_PAGES || 0);

fs.mkdirSync(path.dirname(CHECKPOINT), { recursive: true });
fs.mkdirSync(path.dirname(UNKNOWN_LOG), { recursive: true });

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function authorization(body) {
    const appId = process.env.SHOPEE_AFFILIATE_APP_ID;
    const secret = process.env.SHOPEE_AFFILIATE_SECRET;

    if (!appId || !secret) {
        throw new Error('Credenciais Shopee nao encontradas');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();

    const signature = crypto
        .createHash('sha256')
        .update(appId + timestamp + body + secret)
        .digest('hex');

    return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

async function graphql(query) {
    let lastError;

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const body = JSON.stringify({ query });

            const response = await fetch(API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: authorization(body)
                },
                body
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            if (data.errors?.length) {
                throw new Error(JSON.stringify(data.errors));
            }

            return data.data;
        } catch (error) {
            lastError = error;

            console.log(
                `Tentativa ${attempt}/5 falhou:`,
                error.message
            );

            await sleep(attempt * 2000);
        }
    }

    throw lastError;
}

function extractShopId(link, itemId) {
    link = String(link || '');

    let m = link.match(/\/product\/(\d+)\/(\d+)/);

    if (m && (!itemId || m[2] === String(itemId))) {
        return m[1];
    }

    m = link.match(/-i\.(\d+)\.(\d+)/);

    if (m && (!itemId || m[2] === String(itemId))) {
        return m[1];
    }

    return '';
}

function readCheckpoint() {
    try {
        return JSON.parse(
            fs.readFileSync(CHECKPOINT, 'utf8')
        );
    } catch {
        return null;
    }
}

function saveCheckpoint(data) {
    const temp = CHECKPOINT + '.tmp';

    fs.writeFileSync(
        temp,
        JSON.stringify(data, null, 2)
    );

    fs.renameSync(temp, CHECKPOINT);
}

function openDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB, error => {
            if (error) reject(error);
            else resolve(db);
        });
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(error) {
            if (error) reject(error);
            else resolve(this);
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) reject(error);
            else resolve(row);
        });
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close(error => {
            if (error) reject(error);
            else resolve();
        });
    });
}

const UPSERT = `
INSERT INTO products (
    itemid,
    shop_id,
    title,
    description,
    image_link,
    image_link_3,
    model_ids,
    model_names,
    category1,
    category2,
    category3,
    catid1,
    catid2,
    catid3,
    item_rating,
    shop_name,
    shop_rating,
    likes,
    price,
    sale_price,
    discount_percentage,
    condition,
    cb_option,
    product_link,
    product_short_link
)
VALUES (
    ?,?,?,?,?,?,?,?,?,?,
    ?,?,?,?,?,?,?,?,?,?,
    ?,?,?,?,?
)
ON CONFLICT(itemid) DO UPDATE SET
    shop_id = CASE
        WHEN excluded.shop_id <> ''
        THEN excluded.shop_id
        ELSE products.shop_id
    END,
    title = excluded.title,
    description = excluded.description,
    image_link = excluded.image_link,
    image_link_3 = excluded.image_link_3,
    model_ids = excluded.model_ids,
    model_names = excluded.model_names,
    category1 = excluded.category1,
    category2 = excluded.category2,
    category3 = excluded.category3,
    catid1 = excluded.catid1,
    catid2 = excluded.catid2,
    catid3 = excluded.catid3,
    item_rating = excluded.item_rating,
    shop_name = excluded.shop_name,
    shop_rating = excluded.shop_rating,
    likes = excluded.likes,
    price = excluded.price,
    sale_price = excluded.sale_price,
    discount_percentage = excluded.discount_percentage,
    condition = excluded.condition,
    cb_option = excluded.cb_option,
    product_link = excluded.product_link,
    product_short_link = excluded.product_short_link
`;

function productValues(p) {
    const itemId = String(p.itemid || '');

    return [
        itemId,
        extractShopId(p.product_link, itemId),
        p.title ?? null,
        p.description ?? null,
        p.image_link ?? null,
        p.image_link_3 ?? null,
        p.model_ids ?? null,
        p.model_names ?? null,
        p.global_category1 ?? null,
        p.global_category2 ?? null,
        p.global_category3 ?? null,
        p.global_catid1 ?? null,
        p.global_catid2 ?? null,
        p.global_catid3 ?? null,
        p.item_rating ?? null,
        p.shop_name ?? null,
        p.shop_rating ?? null,
        p.like ?? null,
        p.price ?? null,
        p.sale_price ?? null,
        p.discount_percentage ?? null,
        p.condition ?? null,
        p.cb_option ?? null,
        p.product_link ?? null,
        p['product_short link'] ?? null
    ];
}

(async () => {
    let db;

    try {
        const feedData = await graphql(`
            query {
                listItemFeeds(feedMode: DELTA) {
                    feeds {
                        datafeedId
                        referenceId
                        datafeedName
                        totalCount
                        date
                    }
                }
            }
        `);

        const feeds = (
            feedData.listItemFeeds?.feeds || []
        )
            .filter(f => f.referenceId === REFERENCE_ID)
            .sort((a, b) =>
                String(b.date).localeCompare(String(a.date))
            );

        const feed = feeds[0];

        if (!feed) {
            throw new Error('Feed DELTA oficial nao encontrado');
        }

        const checkpoint = readCheckpoint();

        let offset = 0;

        if (
            checkpoint &&
            checkpoint.datafeedId === feed.datafeedId
        ) {
            offset = Number(checkpoint.offset || 0);
        }

        console.log('=== SHOPEE DELTA SYNC ===');
        console.log('Feed:', feed.datafeedId);
        console.log('Data:', feed.date);
        console.log('Eventos:', feed.totalCount);
        console.log('Offset inicial:', offset);

        db = await openDb();

        let pages = 0;

        const totals = {
            NEW: 0,
            UPDATE: 0,
            DELETE: 0,
            UNKNOWN: 0
        };

        while (offset < Number(feed.totalCount)) {
            const pageData = await graphql(`
                query {
                    getItemFeedData(
                        datafeedId: "${feed.datafeedId}"
                        offset: ${offset}
                        limit: ${LIMIT}
                    ) {
                        rows {
                            columns
                            updateType
                        }
                        pageInfo {
                            offset
                            limit
                            totalCount
                            hasMore
                        }
                    }
                }
            `);

            const result = pageData.getItemFeedData;
            const rows = result?.rows || [];

            if (!rows.length) {
                console.log('Pagina vazia. Encerrando.');
                break;
            }

            await run(db, 'BEGIN IMMEDIATE');

            try {
                for (const row of rows) {
                    const type = row.updateType || 'UNKNOWN';

                    let product;

                    try {
                        product = JSON.parse(row.columns);
                    } catch {
                        totals.UNKNOWN++;
                        continue;
                    }

                    const itemId = String(product.itemid || '');

                    if (!itemId) {
                        totals.UNKNOWN++;
                        continue;
                    }

                    if (type === 'DELETE') {
                        await run(
                            db,
                            'DELETE FROM products WHERE itemid = ?',
                            [itemId]
                        );

                        totals.DELETE++;
                        continue;
                    }

                    if (type === 'NEW' || type === 'UPDATE') {
                        await run(
                            db,
                            UPSERT,
                            productValues(product)
                        );

                        totals[type]++;
                        continue;
                    }

                    totals.UNKNOWN++;

                    fs.appendFileSync(
                        UNKNOWN_LOG,
                        JSON.stringify({
                            feed: feed.datafeedId,
                            offset,
                            updateType: type,
                            itemid: itemId
                        }) + '\n'
                    );
                }

                await run(db, 'COMMIT');
            } catch (error) {
                await run(db, 'ROLLBACK');
                throw error;
            }

            offset += rows.length;
            pages++;

            saveCheckpoint({
                datafeedId: feed.datafeedId,
                date: feed.date,
                offset,
                totalCount: Number(feed.totalCount),
                completed:
                    offset >= Number(feed.totalCount),
                updatedAt: new Date().toISOString()
            });

            console.log(
                `Pagina ${pages}: ${offset}/${feed.totalCount}`,
                totals
            );

            if (MAX_PAGES && pages >= MAX_PAGES) {
                console.log('Limite de teste atingido.');
                break;
            }

            if (!result.pageInfo?.hasMore) {
                break;
            }

            await sleep(800);
        }

        const count = await get(
            db,
            'SELECT COUNT(*) AS total FROM products'
        );

        const shops = await get(
            db,
            `
            SELECT COUNT(DISTINCT shop_id) AS total
            FROM products
            WHERE shop_id <> ''
            `
        );

        console.log();
        console.log('=== RESULTADO ===');
        console.log('Produtos:', count.total);
        console.log('Lojas:', shops.total);
        console.log('Eventos aplicados:', totals);
        console.log('Offset final:', offset);

        await close(db);
    } catch (error) {
        console.error('ERRO:', error);

        if (db) {
            try {
                await close(db);
            } catch {}
        }

        process.exitCode = 1;
    }
})();

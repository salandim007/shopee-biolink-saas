'use strict';

const path = require('path');
const sqlite3 = require('sqlite3');

const {
    fetchProductOfferByItemId
} = require('./shopee-product-url');

const publicationHistoryStore =
    require('./marketing/publication-history-store');

const DATABASE_FILE = path.join(
    __dirname,
    'data',
    'shopee-feed-api',
    'index',
    'catalog.sqlite'
);

function text(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const result = String(value).trim();

    return result || null;
}

function number(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const result = Number(value);

    return Number.isFinite(result)
        ? result
        : null;
}

function unique(values) {
    return [
        ...new Set(
            values
                .map(text)
                .filter(Boolean)
        )
    ];
}

function normalizeProduct(row) {
    if (!row) {
        return null;
    }

    const images = unique([
        row.image_link,
        row.image_link_3
    ]);

    const price = number(row.price);
    const salePrice = number(row.sale_price);

    return {
        marketplace: 'shopee',

        itemId: text(row.itemid),
        shopId: text(row.shop_id),

        title: text(row.title),
        description: text(row.description),

        image: images[0] || null,
        images,

        video: null,
        videos: [],

        media: {
            image: images[0] || null,
            images,
            video: null,
            videos: [],
            imageCount: images.length,
            videoCount: 0,
            source: 'shopee_catalog_feed'
        },

        offer: {
            price,
            salePrice,
            currentPrice: salePrice ?? price,
            discountPercentage: number(
                row.discount_percentage
            ),
            condition: text(row.condition)
        },

        ratings: {
            product:
                number(
                    row.item_rating
                ),

            shop:
                number(
                    row.shop_rating
                )
        },

        shop: {
            id:
                text(
                    row.shop_id
                ),

            name:
                text(
                    row.shop_name
                ),

            rating:
                number(
                    row.shop_rating
                )
        },

        engagement: {
            likes:
                number(
                    row.likes
                )
        },

        links: {
            product:
                text(
                    row.product_link
                ),

            short:
                text(
                    row.product_short_link
                )
        }
    };
}

let database = null;

function openDatabase() {
    if (database) {
        return Promise.resolve(database);
    }

    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(
            DATABASE_FILE,
            sqlite3.OPEN_READONLY,
            (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                database = db;
                resolve(database);
            }
        );
    });
}

async function get(sql, params = []) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        db.get(
            sql,
            params,
            (error, row) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(row || null);
            }
        );
    });
}

async function all(
    sql,
    params = []
) {
    const db =
        await openDatabase();

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


async function listProducts(options = {}) {
    const search =
        String(options.search || '').trim();

    const limit =
        Math.min(
            Math.max(
                Number(options.limit) || 24,
                1
            ),
            100
        );

    const offset =
        Math.max(
            Number(options.offset) || 0,
            0
        );

    let where = '';
    const params = [];

    if (search) {
        where = `
            WHERE
                itemid = ?
                OR LOWER(title) LIKE LOWER(?)
                OR LOWER(shop_name) LIKE LOWER(?)
        `;

        params.push(
            search,
            `%${search}%`,
            `%${search}%`
        );
    }

    const totalRow =
        await get(
            `
                SELECT COUNT(*) AS total
                FROM products
                ${where}
            `,
            params
        );

    const rows =
        await all(
            `
                SELECT
                    itemid,
                    shop_id,
                    title,
                    image_link,
                    image_link_3,
                    item_rating,
                    shop_name,
                    shop_rating,
                    price,
                    sale_price,
                    discount_percentage,
                    condition,
                    product_link,
                    product_short_link
                FROM products
                ${where}
                ORDER BY
                    item_rating DESC,
                    discount_percentage DESC
                LIMIT ?
                OFFSET ?
            `,
            [
                ...params,
                limit,
                offset
            ]
        );

    return {
        total:
            Number(
                totalRow?.total || 0
            ),

        limit,
        offset,

        products:
            rows.map(
                row => {
                    const product =
                        normalizeProduct(row);

                    return {
                        itemId:
                            product.itemId,

                        shopId:
                            product.shopId,

                        title:
                            product.title,

                        image:
                            product.image,

                        offer:
                            product.offer,

                        ratings:
                            product.ratings,

                        shop:
                            product.shop,

                        links:
                            product.links
                    };
                }
            )
    };
}


async function getExactMarketStats(row) {
    if (!row) {
        return null;
    }

    const title =
        text(row.title);

    const modelNames =
        text(row.model_names);

    if (!title && !modelNames) {
        return null;
    }

    const sql = `
        SELECT
            COUNT(*) AS offerCount,
            COUNT(DISTINCT shop_id) AS storeCount,
            MIN(
                COALESCE(
                    sale_price,
                    price
                )
            ) AS lowestPrice,
            MAX(
                COALESCE(
                    sale_price,
                    price
                )
            ) AS highestPrice
        FROM products
        WHERE
            (
                ? IS NOT NULL
                AND LOWER(TRIM(title)) =
                    LOWER(TRIM(?))
            )
            OR
            (
                ? IS NOT NULL
                AND LOWER(TRIM(model_names)) =
                    LOWER(TRIM(?))
            )
    `;

    const stats =
        await get(
            sql,
            [
                title,
                title,
                modelNames,
                modelNames
            ]
        );

    return {
        exact: {
            offerCount:
                number(
                    stats?.offerCount
                ) || 0,

            storeCount:
                number(
                    stats?.storeCount
                ) || 0,

            lowestPrice:
                number(
                    stats?.lowestPrice
                ),

            highestPrice:
                number(
                    stats?.highestPrice
                ),

            source:
                'catalog.sqlite',

            matchMethod:
                'exact_title_or_model'
        },

        similar: {
            offerCount: null,
            storeCount: null,
            status:
                'pending_ai_match'
        }
    };
}


async function getExistingProductIds(
    itemIds = []
) {
    const ids =
        [...new Set(
            itemIds
                .map(text)
                .filter(Boolean)
        )];

    if (ids.length === 0) {
        return new Set();
    }

    const found =
        new Set();

    const chunkSize = 400;

    for (
        let i = 0;
        i < ids.length;
        i += chunkSize
    ) {
        const chunk =
            ids.slice(
                i,
                i + chunkSize
            );

        const placeholders =
            chunk.map(() => '?').join(',');

        const rows =
            await all(
                `
                    SELECT itemid
                    FROM products
                    WHERE itemid IN (${placeholders})
                `,
                chunk
            );

        for (const row of rows) {
            found.add(
                String(row.itemid)
            );
        }
    }

    return found;
}


async function hasProductByItemId(
    itemId
) {
    const normalizedItemId =
        text(itemId);

    if (!normalizedItemId) {
        return false;
    }

    const row =
        await get(
            `
                SELECT 1 AS found
                FROM products
                WHERE itemid = ?
                LIMIT 1
            `,
            [
                normalizedItemId
            ]
        );

    return Boolean(row);
}


async function getProductByItemId(
    itemId,
    options = {}
) {
    const normalizedItemId = text(itemId);
    const normalizedShopId = text(options.shopId);

    if (!normalizedItemId) {
        throw new Error(
            'itemId é obrigatório.'
        );
    }

    let sql = `
        SELECT
            itemid,
            shop_id,
            title,
            description,
            image_link,
            image_link_3,
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
        FROM products
        WHERE itemid = ?
    `;

    const params = [
        normalizedItemId
    ];

    if (normalizedShopId) {
        sql += ' AND shop_id = ?';
        params.push(normalizedShopId);
    }

    sql += ' LIMIT 1';

    const row = await get(
        sql,
        params
    );

    const product =
        normalizeProduct(row);

    if (!product) {
        return null;
    }

    product.market =
        await getExactMarketStats(
            row
        );

    try {
        const result =
            await fetchProductOfferByItemId(
                normalizedItemId
            );

        const apiProduct =
            result?.product || null;

        if (apiProduct) {
            const commissionRate =
                number(
                    apiProduct.commissionRate
                );

            const apiCommission =
                number(
                    apiProduct.commission
                );

            const apiPrice =
                number(
                    apiProduct.price
                );

            const estimatedCommission =
                apiCommission ??
                (
                    commissionRate !== null &&
                    apiPrice !== null
                        ? apiPrice * commissionRate
                        : null
                );

            product.commercial = {
                available: true,

                sales:
                    number(
                        apiProduct.sales
                    ),

                rating:
                    number(
                        apiProduct.ratingStar
                    ),

                commissionRate,

                commissionPercent:
                    commissionRate === null
                        ? null
                        : Number(
                            (
                                commissionRate * 100
                            ).toFixed(2)
                        ),

                commission:
                    apiCommission,

                estimatedCommission,

                sellerCommissionRate:
                    number(
                        apiProduct.sellerCommissionRate
                    ),

                shopeeCommissionRate:
                    number(
                        apiProduct.shopeeCommissionRate
                    ),

                source:
                    'shopee_affiliate_api'
            };
        }
    } catch (error) {
        product.commercial = {
            available: false,
            error: error.message,
            source: 'shopee_affiliate_api'
        };
    }

    try {
        product.publications =
            await publicationHistoryStore
                .getProductPublicationStats({
                    marketplace:
                        product.marketplace ||
                        'shopee',

                    itemId:
                        product.itemId
                });
    } catch (error) {
        product.publications = {
            total: 0,
            lastPublishedAt: null,
            byChannel: {},
            formats: [],
            error:
                error.message
        };
    }

    return product;
}

async function close() {
    if (!database) {
        return;
    }

    const db = database;
    database = null;

    await new Promise((resolve, reject) => {
        db.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

module.exports = {
    DATABASE_FILE,
    getExistingProductIds,
    hasProductByItemId,
    getProductByItemId,
    listProducts,
    normalizeProduct,
    close
};

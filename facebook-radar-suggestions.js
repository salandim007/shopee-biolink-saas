const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const {
    findPublishedProduct,
    generateKeywords
} = require('./facebook-radar-keywords');

const db = new sqlite3.Database(
    path.join(__dirname, 'database.sqlite')
);

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) return reject(error);
            resolve(rows || []);
        });
    });
}

function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokens(text) {
    const ignored = new Set([
        'para', 'com', 'das', 'dos', 'uma',
        'de', 'da', 'do', 'em', 'e'
    ]);

    return normalize(text)
        .split(' ')
        .filter(word =>
            word.length >= 4 &&
            !ignored.has(word)
        );
}

function isGeneralTag(tag) {
    const t = normalize(tag);

    return [
        'shopee',
        'achadinho',
        'achadinhos',
        'oferta',
        'ofertas',
        'promocao',
        'promocoes',
        'compra',
        'venda',
        'compras'
    ].some(term => t.includes(term));
}

function sizeScore(members) {
    const n = Number(members || 0);

    if (n >= 100000) return 20;
    if (n >= 50000) return 18;
    if (n >= 20000) return 15;
    if (n >= 10000) return 12;
    if (n >= 5000) return 9;
    if (n >= 1000) return 6;

    return 3;
}

async function suggestForProduct(itemId, limit = 20) {
    const entry = findPublishedProduct(itemId);

    if (!entry) {
        throw new Error(
            'Produto publicado não encontrado.'
        );
    }

    const product = entry.product;
    const keywords = generateKeywords(product);

    const productText = [
        product.title,
        product.category1,
        product.category2,
        product.category3,
        ...keywords
    ].join(' ');

    const productTokens =
        new Set(tokens(productText));

    const rows = await all(`
        SELECT
            g.id,
            g.facebook_group_id,
            g.name,
            g.url,
            g.privacy,
            g.members_count,
            g.posts_today,
            g.activity_checked_at,
            g.group_posts_today,
            g.group_posts_last_month,
            g.members_growth_week,
            g.group_activity_checked_at,
            g.membership_status,
            GROUP_CONCAT(t.tag, '|||') AS tags
        FROM facebook_groups g
        LEFT JOIN facebook_group_tags t
            ON t.group_id = g.id
        WHERE
            g.status = 'ACTIVE'
            AND g.membership_status = 'Ja participa'
            AND COALESCE(g.radar_enabled, 1) = 1
        GROUP BY g.id
    `);

    const suggestions = rows.map(group => {
        const tags = String(group.tags || '')
            .split('|||')
            .map(v => v.trim())
            .filter(Boolean);

        let affinity = 0;
        const reasons = [];

        for (const tag of tags) {
            const tagTokens = tokens(tag);

            const matches = tagTokens.filter(
                token => productTokens.has(token)
            );

            if (matches.length) {
                affinity += Math.min(
                    40,
                    matches.length * 12
                );

                reasons.push(
                    'Afinidade: ' +
                    matches.join(', ')
                );
            }
        }

        const general =
            tags.some(isGeneralTag);

        if (general) {
            affinity += 20;
            reasons.push(
                'Grupo geral de ofertas/Shopee'
            );
        }

        const membersPoints =
            sizeScore(group.members_count);

        const totalScore =
            Math.min(
                100,
                50 +
                affinity +
                membersPoints
            );

        if (!reasons.length) {
            reasons.push(
                'Opção geral para postagem'
            );
        }

        return {
            ...group,
            tags,
            general,
            affinityScore: affinity,
            sizeScore: membersPoints,
            totalScore,
            reasons
        };
    });

    suggestions.sort((a, b) =>
        b.totalScore - a.totalScore ||
        b.members_count - a.members_count
    );

    return {
        product: {
            itemId: product.itemId,
            title: product.title,
            category1: product.category1,
            category2: product.category2,
            category3: product.category3
        },
        keywords,
        count: suggestions.length,
        suggestions:
            suggestions.slice(
                0,
                Math.max(
                    1,
                    Math.min(Number(limit || 20), 50)
                )
            )
    };
}

module.exports = {
    suggestForProduct
};

if (require.main === module) {
    const itemId = process.argv[2];

    suggestForProduct(itemId)
        .then(result => {
            console.log(
                JSON.stringify(
                    result,
                    null,
                    2
                )
            );
            db.close();
        })
        .catch(error => {
            console.error(error);
            db.close();
            process.exit(1);
        });
}

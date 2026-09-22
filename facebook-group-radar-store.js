const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH =
    path.join(__dirname, 'database.sqlite');

const db =
    new sqlite3.Database(DB_PATH);

db.configure(
    'busyTimeout',
    5000
);


function run(sql, params = []) {
    return new Promise(
        (resolve, reject) => {
            db.run(
                sql,
                params,
                function (error) {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
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

                    resolve(row || null);
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

                    resolve(rows || []);
                }
            );
        }
    );
}


async function initFacebookGroupRadarStore() {
    await run(`
        CREATE TABLE IF NOT EXISTS facebook_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            facebook_group_id TEXT,
            name TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,

            privacy TEXT,
            members_count INTEGER DEFAULT 0,

            activity_level TEXT,
            activity_score REAL DEFAULT 0,

            membership_status TEXT,
            can_join INTEGER DEFAULT 0,
            requires_questions INTEGER DEFAULT 0,

            status TEXT DEFAULT 'ACTIVE',
            source TEXT DEFAULT 'local_agent',

            last_validated_at TEXT,

            created_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await run(`
        CREATE UNIQUE INDEX IF NOT EXISTS
            idx_facebook_groups_group_id
        ON facebook_groups (
            facebook_group_id
        )
        WHERE facebook_group_id IS NOT NULL
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
            idx_facebook_groups_members
        ON facebook_groups (
            members_count DESC
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS facebook_group_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            group_id INTEGER NOT NULL,

            marketplace TEXT NOT NULL
                DEFAULT 'shopee',

            item_id TEXT NOT NULL,
            shop_id TEXT,

            product_title TEXT,

            keywords_json TEXT
                DEFAULT '[]',

            relevance_score REAL DEFAULT 0,
            size_score REAL DEFAULT 0,
            activity_score REAL DEFAULT 0,
            performance_score REAL DEFAULT 0,

            total_score REAL DEFAULT 0,

            clicks INTEGER DEFAULT 0,
            outbound_visits INTEGER DEFAULT 0,

            selected INTEGER DEFAULT 0,

            created_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TEXT NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (
                group_id
            )
            REFERENCES facebook_groups(id)
            ON DELETE CASCADE,

            UNIQUE (
                group_id,
                marketplace,
                item_id
            )
        )
    `);

    await run(`
        CREATE INDEX IF NOT EXISTS
            idx_facebook_group_matches_ranking
        ON facebook_group_matches (
            marketplace,
            item_id,
            total_score DESC
        )
    `);

    return true;
}


async function upsertGroup(group = {}) {
    const url =
        String(group.url || '').trim();

    const name =
        String(group.name || '').trim();

    if (!url) {
        throw new Error(
            'URL do grupo é obrigatória.'
        );
    }

    if (!name) {
        throw new Error(
            'Nome do grupo é obrigatório.'
        );
    }

    await run(
        `
        INSERT INTO facebook_groups (
            facebook_group_id,
            name,
            url,
            privacy,
            members_count,
            activity_level,
            activity_score,
            membership_status,
            can_join,
            requires_questions,
            status,
            source,
            last_validated_at,
            updated_at
        )
        VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT(url)
        DO UPDATE SET
            facebook_group_id =
                excluded.facebook_group_id,

            name =
                excluded.name,

            privacy =
                excluded.privacy,

            members_count =
                excluded.members_count,

            activity_level =
                excluded.activity_level,

            activity_score =
                excluded.activity_score,

            membership_status =
                excluded.membership_status,

            can_join =
                excluded.can_join,

            requires_questions =
                excluded.requires_questions,

            status =
                excluded.status,

            source =
                excluded.source,

            last_validated_at =
                excluded.last_validated_at,

            updated_at =
                CURRENT_TIMESTAMP
        `,
        [
            group.facebookGroupId || null,
            name,
            url,
            group.privacy || null,
            Number(group.membersCount || 0),
            group.activityLevel || null,
            Number(group.activityScore || 0),
            group.membershipStatus || null,
            group.canJoin ? 1 : 0,
            group.requiresQuestions ? 1 : 0,
            group.status || 'ACTIVE',
            group.source || 'local_agent',
            group.lastValidatedAt ||
                new Date().toISOString()
        ]
    );

    return get(
        `
        SELECT *
        FROM facebook_groups
        WHERE url = ?
        LIMIT 1
        `,
        [url]
    );
}


async function upsertMatch(match = {}) {
    const groupId =
        Number(match.groupId);

    const itemId =
        String(match.itemId || '').trim();

    const marketplace =
        String(
            match.marketplace ||
            'shopee'
        ).trim();

    if (!groupId) {
        throw new Error(
            'groupId é obrigatório.'
        );
    }

    if (!itemId) {
        throw new Error(
            'itemId é obrigatório.'
        );
    }

    const relevanceScore =
        Number(
            match.relevanceScore || 0
        );

    const sizeScore =
        Number(
            match.sizeScore || 0
        );

    const activityScore =
        Number(
            match.activityScore || 0
        );

    const performanceScore =
        Number(
            match.performanceScore || 0
        );

    /*
     * Peso inicial do Radar:
     *
     * afinidade     = 45%
     * atividade     = 25%
     * tamanho       = 20%
     * desempenho    = 10%
     *
     * Depois o Learning Engine poderá
     * recalibrar esses pesos.
     */
    const totalScore =
        Number(
            (
                relevanceScore * 0.45 +
                activityScore * 0.25 +
                sizeScore * 0.20 +
                performanceScore * 0.10
            ).toFixed(2)
        );

    const keywords =
        Array.isArray(match.keywords)
            ? match.keywords
            : [];

    await run(
        `
        INSERT INTO facebook_group_matches (
            group_id,
            marketplace,
            item_id,
            shop_id,
            product_title,
            keywords_json,
            relevance_score,
            size_score,
            activity_score,
            performance_score,
            total_score,
            selected,
            updated_at
        )
        VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT(
            group_id,
            marketplace,
            item_id
        )
        DO UPDATE SET
            shop_id =
                excluded.shop_id,

            product_title =
                excluded.product_title,

            keywords_json =
                excluded.keywords_json,

            relevance_score =
                excluded.relevance_score,

            size_score =
                excluded.size_score,

            activity_score =
                excluded.activity_score,

            performance_score =
                excluded.performance_score,

            total_score =
                excluded.total_score,

            selected =
                excluded.selected,

            updated_at =
                CURRENT_TIMESTAMP
        `,
        [
            groupId,
            marketplace,
            itemId,
            match.shopId || null,
            match.productTitle || null,
            JSON.stringify(keywords),
            relevanceScore,
            sizeScore,
            activityScore,
            performanceScore,
            totalScore,
            match.selected ? 1 : 0
        ]
    );

    return get(
        `
        SELECT *
        FROM facebook_group_matches
        WHERE
            group_id = ?
            AND marketplace = ?
            AND item_id = ?
        LIMIT 1
        `,
        [
            groupId,
            marketplace,
            itemId
        ]
    );
}


async function listRankedGroups({
    marketplace = 'shopee',
    itemId,
    limit = 50
} = {}) {
    if (!itemId) {
        throw new Error(
            'itemId é obrigatório.'
        );
    }

    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit || 50),
                200
            )
        );

    const rows =
        await all(
            `
            SELECT
                g.id,
                g.facebook_group_id,
                g.name,
                g.url,
                g.privacy,
                g.members_count,
                g.activity_level,
                g.membership_status,
                g.can_join,
                g.requires_questions,
                g.status,
                g.last_validated_at,

                m.marketplace,
                m.item_id,
                m.shop_id,
                m.product_title,
                m.keywords_json,

                m.relevance_score,
                m.size_score,
                m.activity_score,
                m.performance_score,
                m.total_score,

                m.clicks,
                m.outbound_visits,
                m.selected

            FROM facebook_group_matches m

            INNER JOIN facebook_groups g
                ON g.id = m.group_id

            WHERE
                m.marketplace = ?
                AND m.item_id = ?
                AND g.status = 'ACTIVE'

            ORDER BY
                m.total_score DESC,
                g.members_count DESC

            LIMIT ?
            `,
            [
                marketplace,
                String(itemId),
                safeLimit
            ]
        );

    return rows.map(row => ({
        ...row,

        keywords:
            (() => {
                try {
                    return JSON.parse(
                        row.keywords_json ||
                        '[]'
                    );
                }
                catch {
                    return [];
                }
            })()
    }));
}


async function getStats() {
    const groups =
        await get(`
            SELECT
                COUNT(*) AS total,
                SUM(
                    CASE
                        WHEN status = 'ACTIVE'
                        THEN 1
                        ELSE 0
                    END
                ) AS active
            FROM facebook_groups
        `);

    const matches =
        await get(`
            SELECT
                COUNT(*) AS total,
                SUM(
                    CASE
                        WHEN selected = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS selected
            FROM facebook_group_matches
        `);

    return {
        groups: groups || {
            total: 0,
            active: 0
        },

        matches: matches || {
            total: 0,
            selected: 0
        }
    };
}


async function listGroupsBySource(
    source,
    limit = 200
) {
    return all(
        `
        SELECT *
        FROM facebook_groups
        WHERE source = ?
        ORDER BY
            members_count DESC,
            id DESC
        LIMIT ?
        `,
        [
            source,
            Math.min(Number(limit || 200), 500)
        ]
    );
}

async function deleteGroupsBySource(source) {
    return run(
        `
        DELETE FROM facebook_groups
        WHERE source = ?
        `,
        [source]
    );
}


async function updateGroupActivity(
    groupId,
    postsToday
) {
    const id = Number(groupId);
    const posts = Number(postsToday);

    if (!id) {
        throw new Error(
            'groupId inválido.'
        );
    }

    if (
        !Number.isFinite(posts) ||
        posts < 0
    ) {
        throw new Error(
            'postsToday inválido.'
        );
    }

    await run(
        `
        UPDATE facebook_groups
        SET
            posts_today = ?,
            activity_checked_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
            Math.round(posts),
            new Date().toISOString(),
            id
        ]
    );

    return get(
        `
        SELECT *
        FROM facebook_groups
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    );
}


async function updateGroupFacebookActivity(
    groupId,
    data = {}
) {
    const id = Number(groupId);

    if (!id) {
        throw new Error(
            'groupId inválido.'
        );
    }

    const groupPostsToday =
        Number(data.groupPostsToday);

    const groupPostsLastMonth =
        Number(data.groupPostsLastMonth);

    const membersGrowthWeek =
        Number(data.membersGrowthWeek);

    if (
        !Number.isFinite(groupPostsToday) ||
        groupPostsToday < 0
    ) {
        throw new Error(
            'groupPostsToday inválido.'
        );
    }

    if (
        !Number.isFinite(groupPostsLastMonth) ||
        groupPostsLastMonth < 0
    ) {
        throw new Error(
            'groupPostsLastMonth inválido.'
        );
    }

    if (
        !Number.isFinite(membersGrowthWeek)
    ) {
        throw new Error(
            'membersGrowthWeek inválido.'
        );
    }

    await run(
        `
        UPDATE facebook_groups
        SET
            group_posts_today = ?,
            group_posts_last_month = ?,
            members_growth_week = ?,
            group_activity_checked_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
            Math.round(groupPostsToday),
            Math.round(groupPostsLastMonth),
            Math.round(membersGrowthWeek),
            new Date().toISOString(),
            id
        ]
    );

    return get(
        `
        SELECT *
        FROM facebook_groups
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    );
}


async function setRadarEnabled(groupId, enabled) {
    const id = Number(groupId);

    if (!id) {
        throw new Error('groupId inválido.');
    }

    await run(
        `
        UPDATE facebook_groups
        SET
            radar_enabled = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [enabled ? 1 : 0, id]
    );

    return get(
        `
        SELECT *
        FROM facebook_groups
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    );
}

async function listDisabledGroups() {
    return all(
        `
        SELECT *
        FROM facebook_groups
        WHERE COALESCE(radar_enabled, 1) = 0
        ORDER BY name COLLATE NOCASE ASC
        `
    );
}

module.exports = {
    initFacebookGroupRadarStore,
    upsertGroup,
    upsertMatch,
    listRankedGroups,
    listGroupsBySource,
    deleteGroupsBySource,
    getStats,
    updateGroupActivity,
    updateGroupFacebookActivity,
    setRadarEnabled,
    listDisabledGroups
};

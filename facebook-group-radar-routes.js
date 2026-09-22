const express = require('express');
const radar = require('./facebook-group-radar-store');
const radarKeywords = require('./facebook-radar-keywords');
const radarSuggestions = require('./facebook-radar-suggestions');

const router = express.Router();

router.use(express.json({ limit: '1mb' }));
const ready = radar.initFacebookGroupRadarStore();

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

router.get('/', async (req, res) => {
    try {
        await ready;

        const stats = await radar.getStats();

        res.render('marketing-facebook-groups', {
            stats: {
                groups: {
                    total: num(stats?.groups?.total),
                    active: num(stats?.groups?.active)
                },
                matches: {
                    total: num(stats?.matches?.total),
                    selected: num(stats?.matches?.selected)
                }
            }
        });
    } catch (error) {
        console.error('[RADAR PAGE]', error);
        res.status(500).send('Erro ao abrir Radar.');
    }
});

router.get('/api/health', async (req, res) => {
    try {
        await ready;

        const stats = await radar.getStats();

        res.json({
            success: true,
            service: 'facebook-group-radar',
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/api/ranked', async (req, res) => {
    try {
        await ready;

        const itemId = String(req.query.itemId || '').trim();

        if (!itemId) {
            return res.status(400).json({
                success: false,
                error: 'itemId é obrigatório.'
            });
        }

        const groups = await radar.listRankedGroups({
            marketplace: 'shopee',
            itemId,
            limit: 50
        });

        res.json({
            success: true,
            itemId,
            count: groups.length,
            groups
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


router.get('/api/discovered', async (req, res) => {
    try {
        await ready;

        const groups =
            await radar.listGroupsBySource(
                'fb_validador_20260920_teste',
                200
            );

        res.json({
            success: true,
            count: groups.length,
            groups
        });
    } catch (error) {
        console.error('[RADAR DISCOVERED]', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


router.get('/api/product-keywords', async (req, res) => {
    try {
        const itemId =
            String(req.query.itemId || '').trim();

        if (!itemId) {
            return res.status(400).json({
                success: false,
                error: 'itemId é obrigatório.'
            });
        }

        const entry =
            radarKeywords.findPublishedProduct(itemId);

        if (!entry) {
            return res.status(404).json({
                success: false,
                error: 'Produto publicado não encontrado.'
            });
        }

        const product = entry.product;

        return res.json({
            success: true,
            product: {
                itemId: product.itemId,
                shopId: product.shopId,
                title: product.title,
                category1: product.category1,
                category2: product.category2,
                category3: product.category3
            },
            keywords:
                radarKeywords.generateKeywords(product)
        });
    } catch (error) {
        console.error('[RADAR PRODUCT KEYWORDS]', error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


router.get('/api/suggestions', async (req, res) => {
    try {
        const itemId =
            String(req.query.itemId || '').trim();

        if (!itemId) {
            return res.status(400).json({
                success: false,
                error: 'itemId é obrigatório.'
            });
        }

        const result =
            await radarSuggestions.suggestForProduct(
                itemId,
                20
            );

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('[RADAR SUGGESTIONS]', error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


router.post('/api/activity', async (req, res) => {
    try {
        await ready;

        const groupId =
            Number(req.body?.groupId);

        const postsToday =
            Number(req.body?.postsToday);

        if (!groupId) {
            return res.status(400).json({
                success: false,
                error: 'groupId é obrigatório.'
            });
        }

        if (
            !Number.isFinite(postsToday) ||
            postsToday < 0
        ) {
            return res.status(400).json({
                success: false,
                error: 'postsToday inválido.'
            });
        }

        const group =
            await radar.updateGroupActivity(
                groupId,
                postsToday
            );

        return res.json({
            success: true,
            group
        });

    } catch (error) {
        console.error(
            '[RADAR ACTIVITY]',
            error
        );

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


router.post('/api/group-activity', async (req, res) => {
    try {
        await ready;

        const groupId =
            Number(req.body?.groupId);

        const groupPostsToday =
            Number(req.body?.groupPostsToday);

        const groupPostsLastMonth =
            Number(req.body?.groupPostsLastMonth);

        const membersGrowthWeek =
            Number(req.body?.membersGrowthWeek);

        const group =
            await radar.updateGroupFacebookActivity(
                groupId,
                {
                    groupPostsToday,
                    groupPostsLastMonth,
                    membersGrowthWeek
                }
            );

        return res.json({
            success: true,
            group
        });

    } catch (error) {
        console.error(
            '[RADAR GROUP ACTIVITY]',
            error
        );

        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
});


router.get('/api/disabled', async (req, res) => {
    try {
        await ready;

        const groups =
            await radar.listDisabledGroups();

        return res.json({
            success: true,
            count: groups.length,
            groups
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/api/radar-enabled', async (req, res) => {
    try {
        await ready;

        const groupId =
            Number(req.body?.groupId);

        const enabled =
            Boolean(req.body?.enabled);

        const group =
            await radar.setRadarEnabled(
                groupId,
                enabled
            );

        return res.json({
            success: true,
            group
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

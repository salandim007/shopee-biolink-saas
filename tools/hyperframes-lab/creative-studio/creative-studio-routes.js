'use strict';

const express = require('express');
const { requireAdminAuth } = require('../admin-auth');

const router = express.Router();

// MIX_CREATIVE_STUDIO_AUTH_V1
// Toda rota deste módulo exige autenticação administrativa.
router.use(requireAdminAuth);

// Estudio Criativo IA — interface independente.
// Sem geracao, publicacao ou alteracao de dados.

// MIX_CREATIVE_STUDIO_ASSETS_V1
// Fotografias demonstrativas protegidas pela autenticacao.
const path = require('node:path');

router.use(
    '/assets-demo',
    express.static(
        path.join(__dirname, '../views/creative-studio/assets-demo'),
        {
            index: false,
            fallthrough: false
        }
    )
);

router.get('/', (req, res) => {
    res.render('creative-studio/index');
});


// MIX_CREATIVE_STUDIO_ACERVO_V1
// Consulta somente fotografias ja armazenadas na homologacao.
router.get('/api/acervo/:itemId', async (req, res) => {
    const fs = require('node:fs/promises');
    const itemId = String(req.params.itemId || '');
    const shopId = String(req.query.shopId || '');

    if (!/^\\d+$/.test(itemId)) {
        return res.status(400).json({
            success: false,
            error: 'Item ID invalido'
        });
    }

    try {
        const file = path.join(
            __dirname,
            '../data/vitrine2-catalog.json'
        );

        const catalog = JSON.parse(
            await fs.readFile(file, 'utf8')
        );

        const entries = Array.isArray(catalog.entries)
            ? catalog.entries
            : [];

        const match = entries.find(entry => {
            const product = entry.product || {};

            return String(product.itemId || '') === itemId &&
                (!shopId || String(product.shopId || '') === shopId);
        });

        if (!match) {
            return res.json({
                success: true,
                found: false,
                images: [],
                total: 0
            });
        }

        const product = match.product;

        const images = [...new Set([
            product.image,
            ...(Array.isArray(product.images) ? product.images : [])
        ].filter(url =>
            typeof url === 'string' && url.startsWith('https://')
        ))].slice(0, 15);

        return res.json({
            success: true,
            found: true,
            itemId: product.itemId,
            shopId: product.shopId,
            images,
            total: images.length
        });

    } catch (error) {
        console.error('[Estudio Acervo]', error.message);

        return res.status(500).json({
            success: false,
            error: 'Falha na consulta do acervo'
        });
    }
});


// MIX_STUDIO_ORCHESTRATOR_BRIDGE_V1
// Reutiliza o motor original de mídias da Central de Produção.
router.get('/api/product-media/:shopId/:itemId', async (req, res) => {
    const { getProductMedia } =
        require('../product-media-orchestrator');

    const { shopId, itemId } = req.params;

    if (!/^\d+$/.test(shopId) || !/^\d+$/.test(itemId)) {
        return res.status(400).json({
            success: false,
            error: 'Identificacao invalida'
        });
    }

    try {
        const product = await getProductMedia({
            marketplace: 'shopee',
            url: `https://shopee.com.br/product/${shopId}/${itemId}`,
            minImages: 15,
            enrich: req.query.enrich === '1'
        });

        return res.json({
            success: true,
            product
        });
    } catch (error) {
        console.error('[ESTUDIO MEDIA]', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// MIX_STUDIO_ACERVO_SEARCH_V1
// Pesquisa complementar no acervo já existente.
router.get('/api/search-acervo', (req, res) => {
    try {
        const { defaultCatalogStore } =
            require('../product-catalog-store');

        const catalog = defaultCatalogStore.load();
        const terms = String(req.query.search || '')
            .toLowerCase().trim().split(/\\s+/).filter(Boolean).slice(0, 8);

        const limit = Math.min(
            Math.max(Number(req.query.limit) || 5, 1), 20
        );

        if (!terms.length) {
            return res.json({
                success: true, products: [], total: 0
            });
        }

        const entries = catalog.entries instanceof Map
            ? [...catalog.entries.values()]
            : [];

        const matches = entries
            .map(entry => entry.product)
            .filter(Boolean)
            .filter(product => {
                const text = [
                    product.title, product.itemId, product.shopName
                ].join(' ').toLowerCase();

                return terms.every(term => text.includes(term));
            });

        return res.json({
            success: true,
            products: matches.slice(0, limit).map(product => ({
                itemId: product.itemId,
                shopId: product.shopId,
                title: product.title,
                image: product.image || product.images?.[0] || null
            })),
            total: matches.length
        });
    } catch (error) {
        console.error('[ESTUDIO SEARCH ACERVO]', error.message);
        return res.status(500).json({
            success: false,
            error: 'Erro ao pesquisar acervo'
        });
    }
});


// MIX_STUDIO_UNIFIED_SEARCH_V1
// Pesquisa SQLite + acervo existente em uma unica rota.
router.get('/api/search-unified', async (req, res) => {
    try {
        const { defaultCatalogStore } =
            require('../product-catalog-store');

        const productMediaService =
            require('../product-media-service');

        const search = String(req.query.search || '').trim();

        const limit = Math.min(
            Math.max(Number(req.query.limit) || 5, 1),
            20
        );

        const terms = search.toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 8);

        if (!terms.length) {
            return res.json({
                success: true,
                products: [],
                total: 0
            });
        }

        const catalog = defaultCatalogStore.load();

        const acervo = [...catalog.entries.values()]
            .map(entry => entry.product)
            .filter(Boolean)
            .filter(product => {
                const texto = [
                    product.title,
                    product.itemId,
                    product.shopName
                ].join(' ').toLowerCase();

                return terms.every(term => texto.includes(term));
            })
            .map(product => ({
                itemId: product.itemId,
                shopId: product.shopId,
                title: product.title,
                image: product.image || product.images?.[0] || null
            }));

        const sqlite = await productMediaService.listProducts({
            search,
            limit,
            offset: 0
        });

        const merged = new Map();

        // Prioriza registros que ja possuem fotos no acervo.
        for (const product of [...acervo, ...sqlite.products]) {
            const id = String(product.itemId || '');
            if (id && !merged.has(id)) {
                merged.set(id, product);
            }
        }

        return res.json({
            success: true,
            products: [...merged.values()].slice(0, limit),
            total: sqlite.total + acervo.length
        });

    } catch (error) {
        console.error('[ESTUDIO UNIFIED SEARCH]', error.message);
        return res.status(500).json({
            success: false,
            error: 'Falha na pesquisa unificada'
        });
    }
});


// MIX_HYPERFRAMES_VIDEO_JOBS_V1
// Recebe somente selecoes autorizadas. Nao executa comandos.
router.post('/api/video-jobs', express.json({ limit: '16kb' }), async (req, res) => {
    const fs = require('node:fs/promises');
    const crypto = require('node:crypto');

    try {
        const body = req.body || {};
        const shopId = String(body.shopId || '');
        const itemId = String(body.itemId || '');
        const images = body.images;

        if (!/^\d{1,20}$/.test(shopId) ||
            !/^\d{1,20}$/.test(itemId)) {
            return res.status(400).json({
                success: false,
                error: 'Produto invalido'
            });
        }

        if (!Array.isArray(images) ||
            images.length < 1 ||
            images.length > 5 ||
            images.some(url => typeof url !== 'string' || url.length > 500) ||
            new Set(images).size !== images.length) {
            return res.status(400).json({
                success: false,
                error: 'Selecione de 1 a 5 fotografias distintas'
            });
        }

        // Consulta somente o catalogo local. Nao inicia captura.
        const catalogPath = path.join(
            __dirname, '../data/vitrine2-catalog.json'
        );

        const catalog = JSON.parse(
            await fs.readFile(catalogPath, 'utf8')
        );

        const entries = Array.isArray(catalog.entries)
            ? catalog.entries : [];

        const entry = entries.find(e =>
            String(e.product?.shopId || '') === shopId &&
            String(e.product?.itemId || '') === itemId
        );

        if (!entry) {
            return res.status(404).json({
                success: false,
                error: 'Produto nao encontrado no acervo'
            });
        }

        const product = entry.product;

        const allowed = new Set([
            product.image,
            ...(Array.isArray(product.images) ? product.images : [])
        ].filter(url => typeof url === 'string'));

        if (images.some(url => !allowed.has(url))) {
            return res.status(400).json({
                success: false,
                error: 'Fotografia nao pertence ao produto'
            });
        }

        const jobId = crypto.randomUUID();
        const jobsDir = path.join(
            __dirname, '../data/creative-studio/jobs'
        );

        await fs.mkdir(jobsDir, { recursive: true });

        const jobDir = path.join(jobsDir, jobId);
        await fs.mkdir(jobDir);

        const job = {
            id: jobId,
            status: 'PENDING',
            template: 'mix-impacto-v1',
            product: {
                shopId,
                itemId,
                title: String(product.title || '').slice(0, 180)
            },
            images,
            createdAt: new Date().toISOString(),
            approvalRequired: true
        };

        await fs.writeFile(
            path.join(jobDir, 'job.json'),
            JSON.stringify(job, null, 2),
            { flag: 'wx' }
        );

        return res.status(202).json({
            success: true,
            jobId,
            status: 'PENDING'
        });

    } catch (error) {
        console.error('[HYPERFRAMES JOB]', error.message);

        return res.status(500).json({
            success: false,
            error: 'Falha ao preparar trabalho de video'
        });
    }
});

module.exports = router;

const express = require('express');

const {
    defaultVitrine2Service
} = require('./vitrine2-service');


function createVitrine2Router(
    options = {}
) {
    const router =
        express.Router();

    const service =
        options.service ||
        defaultVitrine2Service;


    /*
     * GET /api/vitrine2/products
     *
     * Lista todos os produtos do catálogo.
     *
     * Uso futuro:
     * Admin da Vitrine 2.
     */
    router.get(
        '/products',
        (req, res) => {
            try {
                const products =
                    service.listAll();

                res.json({
                    success: true,
                    count: products.length,
                    products
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao listar produtos:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        'Não foi possível listar os produtos.'
                });
            }
        }
    );


    /*
     * GET /api/vitrine2/products/published
     *
     * Lista somente produtos publicados.
     *
     * Uso futuro:
     * Vitrine pública.
     */
    router.get(
        '/products/published',
        (req, res) => {
            try {
                const products =
                    service.listPublished();

                res.json({
                    success: true,
                    count: products.length,
                    products
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao listar produtos publicados:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        'Não foi possível listar os produtos publicados.'
                });
            }
        }
    );


    /*
     * GET /api/vitrine2/products/featured
     *
     * Lista somente os produtos publicados
     * que também estão marcados como destaque.
     */
    router.get(
        '/products/featured',
        (req, res) => {
            try {
                const products =
                    service.listFeatured();

                res.json({
                    success: true,
                    count: products.length,
                    products
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao listar destaques:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        'Não foi possível listar os produtos em destaque.'
                });
            }
        }
    );


    /*
     * GET /api/vitrine2/collections/:collection
     *
     * Exemplo:
     *
     * /api/vitrine2/collections/promocoes
     */
    router.get(
        '/collections/:collection',
        (req, res) => {
            try {
                const collection =
                    String(
                        req.params.collection ||
                        ''
                    )
                        .trim()
                        .toLowerCase();

                if (!collection) {
                    return res.status(400).json({
                        success: false,
                        error:
                            'Coleção não informada.'
                    });
                }

                const products =
                    service.listByCollection(
                        collection
                    );

                res.json({
                    success: true,
                    collection,
                    count: products.length,
                    products
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao listar coleção:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        'Não foi possível listar a coleção.'
                });
            }
        }
    );


    /*
     * POST /api/vitrine2/import/api
     *
     * Importa produto pela Shopee Affiliate API.
     *
     * Body:
     *
     * {
     *   "url": "...",
     *   "published": true,
     *   "featured": false,
     *   "position": 1,
     *   "collections": ["promocoes"]
     * }
     */
    router.post(
        '/import/api',
        async (req, res) => {
            try {
                const {
                    url,
                    published = false,
                    featured = false,
                    position = null,
                    collections = []
                } = req.body || {};

                if (
                    !url ||
                    typeof url !== 'string'
                ) {
                    return res.status(400).json({
                        success: false,
                        error:
                            'URL da Shopee não informada.'
                    });
                }

                const entry =
                    await service.importFromApi(
                        url,
                        {
                            published,
                            featured,
                            position,
                            collections
                        }
                    );

                res.status(201).json({
                    success: true,
                    entry
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro na importação pela API:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        error.message ||
                        'Não foi possível importar o produto.'
                });
            }
        }
    );


    /*
     * PATCH /api/vitrine2/products/:marketplace/:itemId/published
     *
     * Body:
     *
     * {
     *   "published": true
     * }
     */
    router.patch(
        '/products/:marketplace/:itemId/published',
        (req, res) => {
            try {
                const {
                    marketplace,
                    itemId
                } = req.params;

                const {
                    published
                } = req.body || {};

                if (
                    typeof published !==
                    'boolean'
                ) {
                    return res.status(400).json({
                        success: false,
                        error:
                            'published deve ser true ou false.'
                    });
                }

                const entry =
                    service.setPublished(
                        marketplace,
                        itemId,
                        published
                    );

                res.json({
                    success: true,
                    entry
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao alterar publicação:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        error.message ||
                        'Não foi possível alterar a publicação.'
                });
            }
        }
    );


    /*
     * PATCH /api/vitrine2/products/:marketplace/:itemId/featured
     *
     * Body:
     *
     * {
     *   "featured": true
     * }
     */
    router.patch(
        '/products/:marketplace/:itemId/featured',
        (req, res) => {
            try {
                const {
                    marketplace,
                    itemId
                } = req.params;

                const {
                    featured
                } = req.body || {};

                if (
                    typeof featured !==
                    'boolean'
                ) {
                    return res.status(400).json({
                        success: false,
                        error:
                            'featured deve ser true ou false.'
                    });
                }

                const entry =
                    service.setFeatured(
                        marketplace,
                        itemId,
                        featured
                    );

                res.json({
                    success: true,
                    entry
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao alterar destaque:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        error.message ||
                        'Não foi possível alterar o destaque.'
                });
            }
        }
    );


    /*
     * PATCH /api/vitrine2/products/:marketplace/:itemId/position
     *
     * Body:
     *
     * {
     *   "position": 1
     * }
     */
    router.patch(
        '/products/:marketplace/:itemId/position',
        (req, res) => {
            try {
                const {
                    marketplace,
                    itemId
                } = req.params;

                const {
                    position
                } = req.body || {};

                const entry =
                    service.setPosition(
                        marketplace,
                        itemId,
                        position
                    );

                res.json({
                    success: true,
                    entry
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao alterar posição:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        error.message ||
                        'Não foi possível alterar a posição.'
                });
            }
        }
    );


    /*
     * POST /api/vitrine2/products/:marketplace/:itemId/collections
     *
     * Body:
     *
     * {
     *   "collection": "promocoes"
     * }
     */
    router.post(
        '/products/:marketplace/:itemId/collections',
        (req, res) => {
            try {
                const {
                    marketplace,
                    itemId
                } = req.params;

                const collection =
                    String(
                        req.body?.collection ||
                        ''
                    )
                        .trim()
                        .toLowerCase();

                if (!collection) {
                    return res.status(400).json({
                        success: false,
                        error:
                            'Coleção não informada.'
                    });
                }

                const entry =
                    service.addToCollection(
                        marketplace,
                        itemId,
                        collection
                    );

                res.json({
                    success: true,
                    entry
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao adicionar coleção:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        error.message ||
                        'Não foi possível adicionar a coleção.'
                });
            }
        }
    );


    /*
     * DELETE /api/vitrine2/products/:marketplace/:itemId/collections/:collection
     */
    router.delete(
        '/products/:marketplace/:itemId/collections/:collection',
        (req, res) => {
            try {
                const {
                    marketplace,
                    itemId
                } = req.params;

                const collection =
                    String(
                        req.params.collection ||
                        ''
                    )
                        .trim()
                        .toLowerCase();

                const entry =
                    service.removeFromCollection(
                        marketplace,
                        itemId,
                        collection
                    );

                res.json({
                    success: true,
                    entry
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao remover coleção:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        error.message ||
                        'Não foi possível remover a coleção.'
                });
            }
        }
    );


    /*
     * DELETE /api/vitrine2/products/:marketplace/:itemId
     */
    router.delete(
        '/products/:marketplace/:itemId',
        (req, res) => {
            try {
                const {
                    marketplace,
                    itemId
                } = req.params;

                const removed =
                    service.removeProduct(
                        marketplace,
                        itemId
                    );

                res.json({
                    success: true,
                    removed
                });
            } catch (error) {
                console.error(
                    '[VITRINE2] Erro ao remover produto:',
                    error
                );

                res.status(500).json({
                    success: false,
                    error:
                        error.message ||
                        'Não foi possível remover o produto.'
                });
            }
        }
    );


    return router;
}


const defaultVitrine2Router =
    createVitrine2Router();


module.exports = {
    createVitrine2Router,
    defaultVitrine2Router
};
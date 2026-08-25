'use strict';

const express =
    require('express');

const {
    syncPublishedProducts
} = require(
    './vitrine2-product-sync-batch'
);


/*
 * ============================================================
 * VITRINE 2 - SYNC ROUTES
 * ============================================================
 *
 * Responsabilidade deste arquivo:
 *
 * - expor uma rota HTTP para sincronização manual;
 * - reaproveitar o sincronizador em lote já validado;
 * - devolver um resumo JSON para o Admin;
 *
 * Este arquivo NÃO altera a vitrine2.ejs.
 * ============================================================
 */


function createVitrine2SyncRouter() {
    const router =
        express.Router();


    /*
     * POST /sync
     *
     * Quando montado em /api/vitrine2:
     *
     * POST /api/vitrine2/sync
     */
    router.post(
        '/sync',
        async (
            req,
            res
        ) => {
            try {
                const summary =
                    await syncPublishedProducts();

                res.json({
                    success:
                        true,

                    message:
                        'Sincronização concluída.',

                    summary
                });
            } catch (error) {
                console.error(
                    '[VITRINE2 SYNC ROUTE] Erro:',
                    error
                );

                res
                    .status(500)
                    .json({
                        success:
                            false,

                        error:
                            error?.message ||
                            'Não foi possível sincronizar a Vitrine 2.'
                    });
            }
        }
    );


    return router;
}


const defaultVitrine2SyncRouter =
    createVitrine2SyncRouter();


module.exports = {
    createVitrine2SyncRouter,
    defaultVitrine2SyncRouter
};

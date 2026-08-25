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
 * - não informar sucesso completo quando houver falhas temporárias.
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

                const temporaryFailures =
                    Number(
                        summary?.failed ||
                        0
                    );

                /*
                 * A sincronização pode terminar tecnicamente
                 * sem lançar exceção, mas ainda possuir
                 * produtos com falhas temporárias.
                 *
                 * Nesse caso NÃO devemos informar ao Admin
                 * que tudo foi concluído com sucesso.
                 */
                if (
                    temporaryFailures >
                    0
                ) {
                    return res.json({
                        success:
                            false,

                        error:
                            temporaryFailures === 1
                                ? 'Sincronização concluída com 1 falha temporária. Verifique o resumo e tente atualizar novamente.'
                                : `Sincronização concluída com ${temporaryFailures} falhas temporárias. Verifique o resumo e tente atualizar novamente.`,

                        summary
                    });
                }

                return res.json({
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

                return res
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
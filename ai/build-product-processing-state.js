'use strict';

const analysisStore =
    require('./product-analysis-store');

const queueStore =
    require('./content-queue-store');

const stateStore =
    require('./product-processing-state-store');


function main() {

    const state = {};

    /*
     * ========================================================
     * ANALISES
     * Último registro do item prevalece.
     * ========================================================
     */

    const analyses =
        analysisStore.readAll();

    for (const item of analyses) {

        const itemId =
            String(
                item.itemId || ''
            ).trim();

        if (!itemId) {
            continue;
        }

        const current =
            state[itemId] || {
                itemId,
                aiProcessed: false,
                analysisStatus: null,
                contentReady: false,
                published: false,
                channels: {},
                lastProcessedAt: null
            };

        current.aiProcessed = true;

        current.analysisStatus =
            item.effectiveStatus ||
            item.status ||
            null;

        current.analysis = {
            prioridade:
                item.analysis?.prioridade || null,

            canal:
                item.analysis?.canal || null,

            formato:
                item.analysis?.formato || null,

            promover:
                item.analysis?.promover ?? null
        };

        current.lastAnalysisAt =
            item.updatedAt ||
            item.generatedAt ||
            item.createdAt ||
            null;

        state[itemId] =
            current;
    }


    /*
     * ========================================================
     * CONTEUDOS
     * Último registro de cada canal prevalece.
     * ========================================================
     */

    const queue =
        queueStore.readQueue();

    for (const item of queue) {

        const itemId =
            String(
                item.itemId || ''
            ).trim();

        if (!itemId) {
            continue;
        }

        const channel =
            String(
                item.channel ||
                'unknown'
            )
                .trim()
                .toLowerCase();

        const current =
            state[itemId] || {
                itemId,
                aiProcessed: false,
                analysisStatus: null,
                contentReady: false,
                published: false,
                channels: {},
                lastProcessedAt: null
            };

        current.channels =
            current.channels || {};

        current.channels[channel] = {
            queueItemId:
                item.id || null,

            status:
                item.status || null,

            format:
                item.format || null,

            source:
                item.recommendation?.source ||
                item.content?.source ||
                null,

            createdAt:
                item.createdAt || null,

            updatedAt:
                item.updatedAt || null,

            approvedAt:
                item.approvedAt || null,

            publishedAt:
                item.publishedAt || null
        };

        state[itemId] =
            current;
    }


    /*
     * ========================================================
     * ESTADO DERIVADO
     * ========================================================
     */

    for (const item of Object.values(state)) {

        const channels =
            Object.values(
                item.channels || {}
            );

        item.contentReady =
            channels.some(
                channel =>
                    channel.status === 'APPROVED' ||
                    channel.status === 'PUBLISHED'
            );

        item.published =
            channels.some(
                channel =>
                    channel.status === 'PUBLISHED'
            );

        const timestamps =
            channels
                .map(
                    channel =>
                        channel.updatedAt ||
                        channel.publishedAt ||
                        channel.approvedAt ||
                        channel.createdAt
                )
                .filter(Boolean)
                .sort();

        item.lastProcessedAt =
            timestamps.length
                ? timestamps[
                    timestamps.length - 1
                ]
                : item.lastAnalysisAt ||
                  null;
    }


    stateStore.writeAll(
        state
    );


    const items =
        Object.values(state);

    const summary = {
        total:
            items.length,

        aiProcessed:
            items.filter(
                item =>
                    item.aiProcessed
            ).length,

        contentReady:
            items.filter(
                item =>
                    item.contentReady
            ).length,

        published:
            items.filter(
                item =>
                    item.published
            ).length,

        aiAndReady:
            items.filter(
                item =>
                    item.aiProcessed &&
                    item.contentReady
            ).length
    };


    console.log(
        'ESTADO CONSOLIDADO CRIADO'
    );

    console.log(
        summary
    );

    console.log(
        'Arquivo:',
        stateStore.STATE_FILE
    );
}


main();

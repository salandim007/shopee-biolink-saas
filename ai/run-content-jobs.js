'use strict';

const jobs =
    require('./content-job-store');

const queue =
    require('./content-queue-store');

const orchestrator =
    require('./content-orchestrator');

const products =
    require('../product-media-service');


async function processJob(job) {
    const startedAt =
        new Date().toISOString();

    jobs.updateJob(
        job.id,
        {
            status: 'PROCESSING',
            progress:
                'Gerando estratégia e conteúdo',
            startedAt,
            error: null
        }
    );

    console.log(
        `Processando ${job.id}`
    );

    console.log(
        `Produto ${job.itemId} | ${job.channel}`
    );

    try {
        const result =
            await orchestrator.prepareContent(
                job.itemId,
                {
                    shopId:
                        job.shopId ||
                        undefined,

                    channel:
                        job.channel,

                    format:
                        job.format ||
                        undefined
                }
            );

        if (
            !result?.success ||
            !result?.queueItem
        ) {
            throw new Error(
                'O conteúdo não foi criado.'
            );
        }

        /*
         * Em um REFazer:
         * a versão antiga só é substituída
         * depois que a nova ficou pronta.
         */
        if (job.replaceQueueItemId) {
            queue.updateQueueItem(
                job.replaceQueueItemId,
                {
                    status: 'REPLACED',
                    replacedBy:
                        result.queueItem.id
                }
            );
        }

        const finishedAt =
            new Date().toISOString();

        jobs.updateJob(
            job.id,
            {
                status: 'DONE',
                progress:
                    'Conteúdo pronto para revisão',
                queueItemId:
                    result.queueItem.id,
                finishedAt
            }
        );

        console.log(
            `OK ${job.itemId} | ${job.channel}`
        );

    } catch (error) {
        jobs.updateJob(
            job.id,
            {
                status: 'FAILED',
                progress:
                    'Falha na geração',
                error:
                    error.message,
                finishedAt:
                    new Date().toISOString()
            }
        );

        console.error(
            `ERRO ${job.itemId} | ${job.channel}:`,
            error.message
        );
    }
}


async function main() {
    const pending =
        jobs.readAll()
            .filter(
                job =>
                    job.status === 'QUEUED'
            );

    console.log(
        `Tarefas pendentes: ${pending.length}`
    );

    for (const job of pending) {
        await processJob(job);
    }

    console.log(
        'Processamento de tarefas concluido.'
    );
}


main()
    .catch(error => {
        console.error(
            'ERRO FATAL:',
            error
        );

        process.exitCode = 1;
    })
    .finally(() => {
        products.close();
    });

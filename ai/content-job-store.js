'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const JOB_FILE =
    path.join(
        __dirname,
        '..',
        'data',
        'ai',
        'content-jobs.json'
    );


function ensureStorage() {
    fs.mkdirSync(
        path.dirname(JOB_FILE),
        {
            recursive: true
        }
    );

    if (!fs.existsSync(JOB_FILE)) {
        fs.writeFileSync(
            JOB_FILE,
            '[]\n',
            'utf8'
        );
    }
}


function readAll() {
    ensureStorage();

    try {
        const data =
            JSON.parse(
                fs.readFileSync(
                    JOB_FILE,
                    'utf8'
                )
            );

        return Array.isArray(data)
            ? data
            : [];
    } catch {
        return [];
    }
}


function writeAll(items) {
    ensureStorage();

    const temp =
        `${JOB_FILE}.tmp`;

    fs.writeFileSync(
        temp,
        JSON.stringify(
            items,
            null,
            2
        ) + '\n',
        'utf8'
    );

    fs.renameSync(
        temp,
        JOB_FILE
    );
}


function createJob(data = {}) {
    const now =
        new Date().toISOString();

    const job = {
        id:
            crypto.randomUUID(),

        itemId:
            String(
                data.itemId || ''
            ),

        channel:
            data.channel || null,

        format:
            data.format || null,

        shopId:
            data.shopId || null,

        replaceQueueItemId:
            data.replaceQueueItemId || null,

        instruction:
            data.instruction || null,

        status:
            'QUEUED',

        progress:
            'Aguardando processamento',

        queueItemId:
            null,

        error:
            null,

        createdAt:
            now,

        startedAt:
            null,

        finishedAt:
            null,

        updatedAt:
            now
    };

    const items =
        readAll();

    items.push(job);

    writeAll(items);

    return job;
}


function getJob(id) {
    return (
        readAll().find(
            item =>
                item.id === id
        ) || null
    );
}


function updateJob(
    id,
    changes = {}
) {
    const items =
        readAll();

    const index =
        items.findIndex(
            item =>
                item.id === id
        );

    if (index < 0) {
        throw new Error(
            'Tarefa de conteúdo não encontrada.'
        );
    }

    items[index] = {
        ...items[index],
        ...changes,

        id:
            items[index].id,

        updatedAt:
            new Date().toISOString()
    };

    writeAll(items);

    return items[index];
}


module.exports = {
    JOB_FILE,
    readAll,
    getJob,
    createJob,
    updateJob
};

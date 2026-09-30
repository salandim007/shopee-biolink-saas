'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const QUEUE_FILE =
    path.join(
        __dirname,
        '..',
        'data',
        'ai',
        'content-queue.json'
    );

const VALID_STATUS =
    new Set([
        'PREPARING',
        'READY_FOR_APPROVAL',
        'APPROVED',
        'REJECTED',
        'REPLACED',
        'PUBLISHED',
        'FAILED'
    ]);


function ensureStorage() {
    fs.mkdirSync(
        path.dirname(QUEUE_FILE),
        {
            recursive: true
        }
    );

    if (!fs.existsSync(QUEUE_FILE)) {
        fs.writeFileSync(
            QUEUE_FILE,
            '[]\n',
            'utf8'
        );
    }
}


function readQueue() {
    ensureStorage();

    try {
        const data =
            JSON.parse(
                fs.readFileSync(
                    QUEUE_FILE,
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


function writeQueue(items) {
    ensureStorage();

    const tempFile =
        `${QUEUE_FILE}.tmp`;

    fs.writeFileSync(
        tempFile,
        JSON.stringify(
            items,
            null,
            2
        ) + '\n',
        'utf8'
    );

    fs.renameSync(
        tempFile,
        QUEUE_FILE
    );
}


function createQueueItem(data = {}) {
    const now =
        new Date().toISOString();

    const item = {
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

        status:
            data.status ||
            'PREPARING',

        recommendation:
            data.recommendation || null,

        plan:
            data.plan || null,

        content:
            data.content || null,

        createdAt:
            now,

        updatedAt:
            now,

        approvedAt:
            null,

        publishedAt:
            null,

        publication:
            null,

        error:
            null
    };

    if (
        !VALID_STATUS.has(
            item.status
        )
    ) {
        throw new Error(
            `Status inválido: ${item.status}`
        );
    }

    const items =
        readQueue();

    items.push(item);

    writeQueue(items);

    return item;
}


function getQueueItem(id) {
    return (
        readQueue()
            .find(
                item =>
                    item.id === id
            ) || null
    );
}


function listQueue(filters = {}) {
    let items =
        readQueue();

    if (filters.status) {
        items =
            items.filter(
                item =>
                    item.status ===
                    filters.status
            );
    }

    if (filters.channel) {
        items =
            items.filter(
                item =>
                    item.channel ===
                    filters.channel
            );
    }

    if (filters.itemId) {
        const itemId =
            String(filters.itemId);

        items =
            items.filter(
                item =>
                    String(item.itemId) ===
                    itemId
            );
    }

    return items;
}


function updateQueueItem(
    id,
    changes = {}
) {
    const items =
        readQueue();

    const index =
        items.findIndex(
            item =>
                item.id === id
        );

    if (index < 0) {
        throw new Error(
            'Conteúdo não encontrado na fila.'
        );
    }

    if (
        changes.status &&
        !VALID_STATUS.has(
            changes.status
        )
    ) {
        throw new Error(
            `Status inválido: ${changes.status}`
        );
    }

    const now =
        new Date().toISOString();

    const updated = {
        ...items[index],
        ...changes,
        id:
            items[index].id,
        updatedAt:
            now
    };

    if (
        changes.status ===
        'APPROVED'
    ) {
        updated.approvedAt =
            now;
    }

    if (
        changes.status ===
        'PUBLISHED'
    ) {
        updated.publishedAt =
            now;
    }

    items[index] =
        updated;

    writeQueue(items);

    return updated;
}


module.exports = {
    QUEUE_FILE,
    VALID_STATUS,
    readQueue,
    listQueue,
    getQueueItem,
    createQueueItem,
    updateQueueItem
};

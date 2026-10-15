'use strict';

const fs = require('fs');
const path = require('path');

const STATE_FILE =
    path.join(
        __dirname,
        '..',
        'data',
        'ai',
        'product-processing-state.json'
    );


function ensureStorage() {
    fs.mkdirSync(
        path.dirname(STATE_FILE),
        {
            recursive: true
        }
    );

    if (!fs.existsSync(STATE_FILE)) {
        fs.writeFileSync(
            STATE_FILE,
            '{}\n',
            'utf8'
        );
    }
}


function readAll() {
    ensureStorage();

    try {
        const parsed =
            JSON.parse(
                fs.readFileSync(
                    STATE_FILE,
                    'utf8'
                )
            );

        return (
            parsed &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed)
        )
            ? parsed
            : {};
    } catch {
        return {};
    }
}


function writeAll(state) {
    ensureStorage();

    const temp =
        `${STATE_FILE}.tmp`;

    fs.writeFileSync(
        temp,
        JSON.stringify(
            state,
            null,
            2
        ) + '\n',
        'utf8'
    );

    fs.renameSync(
        temp,
        STATE_FILE
    );
}


function getByItemId(itemId) {
    const state =
        readAll();

    return (
        state[
            String(itemId)
        ] || null
    );
}


function upsert(itemId, changes = {}) {
    const id =
        String(itemId || '').trim();

    if (!id) {
        throw new Error(
            'itemId obrigatório.'
        );
    }

    const state =
        readAll();

    const current =
        state[id] || {
            itemId: id,
            aiProcessed: false,
            analysisStatus: null,
            contentReady: false,
            published: false,
            channels: {},
            lastProcessedAt: null
        };

    const updated = {
        ...current,
        ...changes,
        itemId: id,
        channels: {
            ...(current.channels || {}),
            ...(changes.channels || {})
        },
        updatedAt:
            new Date().toISOString()
    };

    state[id] =
        updated;

    writeAll(state);

    return updated;
}


function list() {
    return Object.values(
        readAll()
    );
}


module.exports = {
    STATE_FILE,
    readAll,
    writeAll,
    getByItemId,
    upsert,
    list
};

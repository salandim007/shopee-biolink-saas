'use strict';

const fs = require('fs');
const path = require('path');

const SCORE_FILE =
    path.join(
        __dirname,
        '..',
        'data',
        'ai',
        'product-scores-100.json'
    );


function readAll() {
    if (!fs.existsSync(SCORE_FILE)) {
        return [];
    }

    try {
        const data =
            JSON.parse(
                fs.readFileSync(
                    SCORE_FILE,
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


function getByItemId(itemId) {
    const id =
        String(itemId);

    return (
        readAll()
            .find(
                item =>
                    String(item.itemId) === id
            ) || null
    );
}


function getSummary() {
    const items =
        readAll();

    const summary = {
        total: items.length,
        high: 0,
        medium: 0,
        low: 0
    };

    for (const item of items) {
        const level =
            item.score?.level;

        if (level === 'HIGH') {
            summary.high += 1;
        }

        if (level === 'MEDIUM') {
            summary.medium += 1;
        }

        if (level === 'LOW') {
            summary.low += 1;
        }
    }

    return summary;
}


module.exports = {
    SCORE_FILE,
    readAll,
    getByItemId,
    getSummary
};

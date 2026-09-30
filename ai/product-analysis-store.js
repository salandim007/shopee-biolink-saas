'use strict';

const fs = require('fs');
const path = require('path');

const ANALYSIS_FILE =
    path.join(
        __dirname,
        '..',
        'data',
        'ai',
        'product-analysis-100.jsonl'
    );


function readAll() {
    if (!fs.existsSync(ANALYSIS_FILE)) {
        return [];
    }

    const lines =
        fs.readFileSync(
            ANALYSIS_FILE,
            'utf8'
        )
        .split('\n')
        .filter(Boolean);

    const records = [];

    for (const line of lines) {
        try {
            const record =
                JSON.parse(line);

            if (record?.analysis) {
                if (
                    record.analysis.canal === 'null'
                ) {
                    record.analysis.canal = null;
                }

                if (
                    record.analysis.formato === 'null'
                ) {
                    record.analysis.formato = null;
                }
            }

            record.effectiveStatus =
                record.status;

            if (
                record.status === 'NEEDS_REVIEW' &&
                Array.isArray(
                    record.validation?.errors
                ) &&
                record.validation.errors.length > 0 &&
                record.validation.errors.every(
                    error =>
                        error === 'canal inválido' ||
                        error === 'formato inválido'
                )
            ) {
                record.effectiveStatus =
                    'VALIDATED';
            }

            records.push(record);
        } catch {
            // Ignora linha incompleta.
        }
    }

    return records;
}


function appendRecord(record) {
    if (
        !record ||
        typeof record !== 'object' ||
        !record.itemId
    ) {
        throw new Error(
            'Registro de análise inválido.'
        );
    }

    fs.mkdirSync(
        path.dirname(ANALYSIS_FILE),
        {
            recursive: true
        }
    );

    fs.appendFileSync(
        ANALYSIS_FILE,
        JSON.stringify(record) + '\n',
        'utf8'
    );

    return record;
}


function getByItemId(itemId) {
    const id =
        String(itemId);

    const records =
        readAll();

    for (
        let index = records.length - 1;
        index >= 0;
        index -= 1
    ) {
        if (
            String(records[index].itemId) === id
        ) {
            return records[index];
        }
    }

    return null;
}


function getSummary() {
    const records =
        readAll();

    const summary = {
        total: records.length,
        validated: 0,
        needsReview: 0,
        failed: 0,
        promote: 0,
        doNotPromote: 0
    };

    for (const record of records) {
        const status =
            record.effectiveStatus ||
            record.status;

        if (status === 'VALIDATED') {
            summary.validated += 1;
        }

        if (status === 'NEEDS_REVIEW') {
            summary.needsReview += 1;
        }

        if (status === 'FAILED') {
            summary.failed += 1;
        }

        if (
            record.analysis?.promover === true
        ) {
            summary.promote += 1;
        }

        if (
            record.analysis?.promover === false
        ) {
            summary.doNotPromote += 1;
        }
    }

    return summary;
}


module.exports = {
    ANALYSIS_FILE,
    readAll,
    appendRecord,
    getByItemId,
    getSummary
};

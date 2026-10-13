'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT_DIR = path.join(
    process.cwd(),
    'data',
    'video-production',
    'covers'
);

const APPROVED_DIR = path.join(
    ROOT_DIR,
    'approved'
);

const INDEX_FILE = path.join(
    ROOT_DIR,
    'library.json'
);


async function ensureDirectories() {
    await fs.mkdir(
        APPROVED_DIR,
        {
            recursive: true
        }
    );
}


function safeText(value) {
    return String(
        value ?? ''
    ).trim();
}


function safeFilename(value) {
    const filename =
        path.basename(
            safeText(value)
        );

    if (
        !filename ||
        !/^[a-zA-Z0-9._-]+\.(svg|png|jpg|jpeg|webp)$/i.test(
            filename
        )
    ) {
        throw new Error(
            'Arquivo de capa inválido.'
        );
    }

    return filename;
}


async function readIndex() {
    await ensureDirectories();

    try {
        const raw =
            await fs.readFile(
                INDEX_FILE,
                'utf8'
            );

        const data =
            JSON.parse(raw);

        return {
            version: 1,

            selectedCoverId:
                safeText(
                    data.selectedCoverId
                ) || null,

            covers:
                Array.isArray(
                    data.covers
                )
                    ? data.covers
                    : []
        };
    } catch (error) {
        if (
            error.code !== 'ENOENT'
        ) {
            throw error;
        }

        return {
            version: 1,
            selectedCoverId: null,
            covers: []
        };
    }
}


async function writeIndex(data) {
    await ensureDirectories();

    const temporary =
        `${INDEX_FILE}.tmp`;

    await fs.writeFile(
        temporary,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    );

    await fs.rename(
        temporary,
        INDEX_FILE
    );
}


async function listApprovedCovers() {
    const data =
        await readIndex();

    return {
        selectedCoverId:
            data.selectedCoverId,

        covers:
            [...data.covers]
                .sort(
                    (a, b) =>
                        String(
                            b.approvedAt || ''
                        ).localeCompare(
                            String(
                                a.approvedAt || ''
                            )
                        )
                )
    };
}


async function approveCover(input = {}) {
    await ensureDirectories();

    const sourceFilename =
        safeFilename(
            input.filename
        );

    const sourcePath =
        path.join(
            ROOT_DIR,
            sourceFilename
        );

    await fs.access(
        sourcePath
    );

    const extension =
        path.extname(
            sourceFilename
        ).toLowerCase();

    const id =
        `cover-${Date.now()}-${crypto
            .randomBytes(4)
            .toString('hex')}`;

    const approvedFilename =
        `${id}${extension}`;

    const approvedPath =
        path.join(
            APPROVED_DIR,
            approvedFilename
        );

    await fs.copyFile(
        sourcePath,
        approvedPath
    );

    const data =
        await readIndex();

    const record = {
        id,

        filename:
            approvedFilename,

        sourceFilename,

        templateId:
            safeText(
                input.templateId
            ) || 'oferta-forte',

        paletteId:
            safeText(
                input.paletteId
            ) || 'coral',

        itemId:
            safeText(
                input.itemId
            ) || null,

        shopId:
            safeText(
                input.shopId
            ) || null,

        productTitle:
            safeText(
                input.productTitle
            ) || null,

        headline:
            safeText(
                input.headline
            ) || null,

        subheadline:
            safeText(
                input.subheadline
            ) || null,

        badge:
            safeText(
                input.badge
            ) || null,

        cta:
            safeText(
                input.cta
            ) || null,

        price:
            safeText(
                input.price
            ) || null,

        approvedAt:
            new Date()
                .toISOString()
    };

    data.covers.push(
        record
    );

    /*
     * A primeira capa aprovada
     * já vira a seleção inicial.
     * Depois o usuário pode trocar
     * clicando em outra capa.
     */
    if (
        !data.selectedCoverId
    ) {
        data.selectedCoverId =
            record.id;
    }

    await writeIndex(
        data
    );

    return {
        ...record,

        selected:
            data.selectedCoverId ===
            record.id
    };
}


async function selectApprovedCover(id) {
    const coverId =
        safeText(id);

    if (!coverId) {
        throw new Error(
            'Capa inválida.'
        );
    }

    const data =
        await readIndex();

    const exists =
        data.covers.some(
            cover =>
                cover.id ===
                coverId
        );

    if (!exists) {
        throw new Error(
            'Capa aprovada não encontrada.'
        );
    }

    data.selectedCoverId =
        coverId;

    await writeIndex(
        data
    );

    return {
        selectedCoverId:
            coverId
    };
}


async function getApprovedCover(id) {
    const data =
        await readIndex();

    return (
        data.covers.find(
            cover =>
                cover.id ===
                safeText(id)
        ) ||
        null
    );
}


module.exports = {
    ROOT_DIR,
    APPROVED_DIR,
    INDEX_FILE,

    ensureDirectories,
    listApprovedCovers,
    approveCover,
    selectApprovedCover,
    getApprovedCover
};

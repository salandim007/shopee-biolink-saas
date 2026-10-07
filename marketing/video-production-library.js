'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.join(
    process.cwd(),
    'data',
    'video-production'
);

const DIRECTORIES = {
    opening: path.join(ROOT, 'openings'),
    closing: path.join(ROOT, 'closings'),
    output: path.join(ROOT, 'outputs'),
    music: path.join(ROOT, 'music')
};

const SETTINGS_FILE = path.join(
    ROOT,
    'settings.json'
);

const DEFAULT_TYPES = [
    'opening',
    'closing',
    'music'
];


const VIDEO_EXTENSIONS = new Set([
    '.mp4',
    '.mov',
    '.webm'
]);

const MUSIC_EXTENSIONS = new Set([
    '.mp3',
    '.wav',
    '.m4a',
    '.aac',
    '.mp4',
    '.mov',
    '.webm'
]);

function isAllowedExtension(type, extension) {
    if (type === 'music') {
        return MUSIC_EXTENSIONS.has(extension);
    }

    return VIDEO_EXTENSIONS.has(extension);
}

function getDirectory(type) {
    const directory = DIRECTORIES[type];

    if (!directory) {
        throw new Error(
            `Tipo de vídeo inválido: ${type}`
        );
    }

    return directory;
}

function createId(filename) {
    return Buffer
        .from(filename, 'utf8')
        .toString('base64url');
}

function decodeId(id) {
    return Buffer
        .from(
            String(id || ''),
            'base64url'
        )
        .toString('utf8');
}

async function ensureDirectories() {
    await Promise.all(
        Object.values(DIRECTORIES).map(
            directory =>
                fs.mkdir(
                    directory,
                    { recursive: true }
                )
        )
    );
}

async function listVideos(type) {
    await ensureDirectories();

    const directory =
        getDirectory(type);

    const entries =
        await fs.readdir(
            directory,
            {
                withFileTypes: true
            }
        );

    const videos = [];

    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        const extension =
            path
                .extname(entry.name)
                .toLowerCase();

        if (
            !isAllowedExtension(
                type,
                extension
            )
        ) {
            continue;
        }

        const fullPath =
            path.join(
                directory,
                entry.name
            );

        const stats =
            await fs.stat(fullPath);

        videos.push({
            id: createId(entry.name),
            type,
            filename: entry.name,
            name:
                path
                    .basename(
                        entry.name,
                        extension
                    )
                    .replace(/[-_]+/g, ' '),
            extension,
            sizeBytes: stats.size,
            updatedAt:
                stats.mtime.toISOString()
        });
    }

    videos.sort(
        (a, b) =>
            a.name.localeCompare(
                b.name,
                'pt-BR'
            )
    );

    return videos;
}

async function resolveVideoPath(
    type,
    id
) {
    const directory =
        getDirectory(type);

    const filename =
        decodeId(id);

    if (
        !filename ||
        path.basename(filename) !== filename
    ) {
        throw new Error(
            'Identificador de vídeo inválido.'
        );
    }

    const extension =
        path
            .extname(filename)
            .toLowerCase();

    if (
        !isAllowedExtension(
            type,
            extension
        )
    ) {
        throw new Error(
            'Formato de vídeo não permitido.'
        );
    }

    const fullPath =
        path.join(
            directory,
            filename
        );

    await fs.access(fullPath);

    return fullPath;
}


function normalizeSettings(value) {
    const source =
        value &&
        typeof value === 'object'
            ? value
            : {};

    return {
        opening:
            typeof source.opening === 'string'
                ? source.opening
                : null,

        closing:
            typeof source.closing === 'string'
                ? source.closing
                : null,

        music:
            typeof source.music === 'string'
                ? source.music
                : null
    };
}


async function readSettings() {
    await ensureDirectories();

    try {
        const raw =
            await fs.readFile(
                SETTINGS_FILE,
                'utf8'
            );

        return normalizeSettings(
            JSON.parse(raw)
        );
    } catch (error) {
        if (
            error &&
            error.code === 'ENOENT'
        ) {
            return normalizeSettings({});
        }

        throw error;
    }
}


async function writeSettings(settings) {
    await ensureDirectories();

    const normalized =
        normalizeSettings(settings);

    const temporaryFile =
        `${SETTINGS_FILE}.tmp`;

    await fs.writeFile(
        temporaryFile,
        JSON.stringify(
            normalized,
            null,
            2
        ) + '\n',
        'utf8'
    );

    await fs.rename(
        temporaryFile,
        SETTINGS_FILE
    );

    return normalized;
}


/*
 * Retorna os IDs atualmente configurados
 * como padrão.
 *
 * Se ainda não existir configuração e houver
 * exatamente um item daquele tipo, ele vira
 * padrão automaticamente.
 */
async function getDefaultSelections() {
    const settings =
        await readSettings();

    const selections = {
        opening: null,
        closing: null,
        music: null
    };

    let changed = false;

    for (const type of DEFAULT_TYPES) {
        const items =
            await listVideos(type);

        let selectedItem =
            items.find(
                item =>
                    item.filename ===
                    settings[type]
            ) || null;

        if (
            !selectedItem &&
            items.length === 1
        ) {
            selectedItem =
                items[0];

            settings[type] =
                selectedItem.filename;

            changed = true;
        } else if (
            !selectedItem &&
            settings[type]
        ) {
            settings[type] = null;
            changed = true;
        }

        selections[type] =
            selectedItem
                ? selectedItem.id
                : null;
    }

    if (changed) {
        await writeSettings(
            settings
        );
    }

    return selections;
}


/*
 * Define explicitamente um item
 * como padrão daquele tipo.
 */
async function setDefaultSelection(
    type,
    id
) {
    if (
        !DEFAULT_TYPES.includes(type)
    ) {
        throw new Error(
            `Tipo de padrão inválido: ${type}`
        );
    }

    const filePath =
        await resolveVideoPath(
            type,
            id
        );

    const filename =
        path.basename(filePath);

    const settings =
        await readSettings();

    settings[type] =
        filename;

    await writeSettings(
        settings
    );

    return {
        type,
        id,
        filename
    };
}


module.exports = {
    ensureDirectories,
    listVideos,
    resolveVideoPath,
    getDefaultSelections,
    setDefaultSelection,
    DIRECTORIES
};

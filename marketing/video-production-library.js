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

module.exports = {
    ensureDirectories,
    listVideos,
    resolveVideoPath,
    DIRECTORIES
};

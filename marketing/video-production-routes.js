'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const {
    ensureDirectories,
    listVideos,
    resolveVideoPath,
    DIRECTORIES
} = require('./video-production-library');

const router = express.Router();


router.get(
    '/',
    (req, res) => {
        res.render(
            'video-production'
        );
    }
);

const TYPE_EXTENSIONS = {
    opening: new Set([
        '.mp4',
        '.mov',
        '.webm'
    ]),

    closing: new Set([
        '.mp4',
        '.mov',
        '.webm'
    ]),

    music: new Set([
        '.mp3',
        '.wav',
        '.m4a',
        '.aac',
        '.mp4',
        '.mov',
        '.webm'
    ])
};

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize:
            100 * 1024 * 1024
    }
});


function isValidType(type) {
    return Boolean(
        TYPE_EXTENSIONS[type]
    );
}


function sanitizeName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            '-'
        )
        .replace(
            /^-+|-+$/g,
            ''
        )
        .slice(0, 80);
}


async function createAvailableFilename(
    directory,
    baseName,
    extension
) {
    let filename =
        `${baseName}${extension}`;

    let counter = 2;

    while (true) {
        try {
            await fs.access(
                path.join(
                    directory,
                    filename
                )
            );

            filename =
                `${baseName}-${counter}${extension}`;

            counter += 1;
        } catch {
            return filename;
        }
    }
}



function runFfmpeg(args) {
    return new Promise(
        (resolve, reject) => {
            const child = spawn(
                'ffmpeg',
                args,
                {
                    stdio: [
                        'ignore',
                        'ignore',
                        'pipe'
                    ]
                }
            );

            let stderr = '';

            child.stderr.on(
                'data',
                chunk => {
                    stderr +=
                        chunk.toString();

                    if (
                        stderr.length >
                        20000
                    ) {
                        stderr =
                            stderr.slice(
                                -20000
                            );
                    }
                }
            );

            child.on(
                'error',
                reject
            );

            child.on(
                'close',
                code => {
                    if (code === 0) {
                        resolve();
                        return;
                    }

                    reject(
                        new Error(
                            `FFmpeg terminou com código ${code}.\n${stderr}`
                        )
                    );
                }
            );
        }
    );
}


async function normalizeVideo(
    inputPath,
    outputPath
) {
    await runFfmpeg([
        '-y',

        '-i',
        inputPath,

        '-map',
        '0:v:0',

        '-map',
        '0:a:0?',

        '-vf',
        [
            'scale=1080:1920:force_original_aspect_ratio=decrease',
            'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
            'setsar=1'
        ].join(','),

        '-r',
        '30',

        '-c:v',
        'libx264',

        '-preset',
        'medium',

        '-crf',
        '20',

        '-pix_fmt',
        'yuv420p',

        '-c:a',
        'aac',

        '-b:a',
        '192k',

        '-ar',
        '48000',

        '-movflags',
        '+faststart',

        outputPath
    ]);
}


/*
 * Biblioteca completa.
 */
router.get(
    '/api/library',
    async (req, res) => {
        try {
            const [
                openings,
                closings,
                music
            ] = await Promise.all([
                listVideos('opening'),
                listVideos('closing'),
                listVideos('music')
            ]);

            return res.json({
                success: true,
                openings,
                closings,
                music
            });
        } catch (error) {
            console.error(
                '[VIDEO PRODUCTION LIBRARY]',
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    'Não foi possível carregar a biblioteca.'
            });
        }
    }
);


/*
 * Visualizar / reproduzir arquivo.
 */
router.get(
    '/api/:type/:id/file',
    async (req, res) => {
        try {
            const type =
                String(
                    req.params.type || ''
                );

            if (!isValidType(type)) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Tipo de mídia inválido.'
                });
            }

            const filePath =
                await resolveVideoPath(
                    type,
                    req.params.id
                );

            return res.sendFile(
                filePath
            );
        } catch (error) {
            return res.status(404).json({
                success: false,
                error:
                    'Arquivo não encontrado.'
            });
        }
    }
);


/*
 * Adicionar vídeo ou música.
 *
 * opening / closing:
 *   normalizados automaticamente para
 *   MP4 + H.264 + AAC + 1080x1920 + 30 fps.
 *
 * music:
 *   preservada no formato original.
 */
router.post(
    '/api/:type',
    upload.single('file'),
    async (req, res) => {
        let temporaryInput = null;
        let destination = null;

        try {
            const type =
                String(
                    req.params.type || ''
                );

            if (!isValidType(type)) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Tipo de mídia inválido.'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Nenhum arquivo foi enviado.'
                });
            }

            const originalExtension =
                path
                    .extname(
                        req.file.originalname
                    )
                    .toLowerCase();

            if (
                !TYPE_EXTENSIONS[type]
                    .has(originalExtension)
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Formato de arquivo não permitido.'
                });
            }

            await ensureDirectories();

            const baseName =
                sanitizeName(
                    req.body?.name ||
                    path.basename(
                        req.file.originalname,
                        originalExtension
                    )
                ) ||
                `${type}-arquivo`;

            const directory =
                DIRECTORIES[type];

            let filename;

            if (
                type === 'opening' ||
                type === 'closing'
            ) {
                filename =
                    await createAvailableFilename(
                        directory,
                        baseName,
                        '.mp4'
                    );

                destination =
                    path.join(
                        directory,
                        filename
                    );

                const token =
                    [
                        process.pid,
                        Date.now(),
                        Math
                            .random()
                            .toString(36)
                            .slice(2)
                    ].join('-');

                temporaryInput =
                    path.join(
                        directory,
                        `.upload-${token}${originalExtension}`
                    );

                await fs.writeFile(
                    temporaryInput,
                    req.file.buffer
                );

                console.log(
                    '[VIDEO PRODUCTION NORMALIZE]',
                    req.file.originalname,
                    '=>',
                    filename
                );

                await normalizeVideo(
                    temporaryInput,
                    destination
                );

                await fs.rm(
                    temporaryInput,
                    {
                        force: true
                    }
                );

                temporaryInput = null;
            } else {
                filename =
                    await createAvailableFilename(
                        directory,
                        baseName,
                        originalExtension
                    );

                destination =
                    path.join(
                        directory,
                        filename
                    );

                await fs.writeFile(
                    destination,
                    req.file.buffer
                );
            }

            const items =
                await listVideos(type);

            const created =
                items.find(
                    item =>
                        item.filename === filename
                );

            return res.status(201).json({
                success: true,
                item: created || null,
                normalized:
                    type === 'opening' ||
                    type === 'closing'
            });
        } catch (error) {
            console.error(
                '[VIDEO PRODUCTION UPLOAD]',
                error
            );

            if (temporaryInput) {
                await fs.rm(
                    temporaryInput,
                    {
                        force: true
                    }
                ).catch(() => {});
            }

            if (destination) {
                await fs.rm(
                    destination,
                    {
                        force: true
                    }
                ).catch(() => {});
            }

            return res.status(500).json({
                success: false,
                error:
                    'Não foi possível preparar o arquivo.'
            });
        }
    }
);


/*
 * Renomear.
 */
router.patch(
    '/api/:type/:id',
    async (req, res) => {
        try {
            const type =
                String(
                    req.params.type || ''
                );

            if (!isValidType(type)) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Tipo de mídia inválido.'
                });
            }

            const currentPath =
                await resolveVideoPath(
                    type,
                    req.params.id
                );

            const extension =
                path
                    .extname(currentPath)
                    .toLowerCase();

            const requestedName =
                sanitizeName(
                    req.body?.name
                );

            if (!requestedName) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Informe um nome válido.'
                });
            }

            const directory =
                DIRECTORIES[type];

            const filename =
                await createAvailableFilename(
                    directory,
                    requestedName,
                    extension
                );

            const newPath =
                path.join(
                    directory,
                    filename
                );

            await fs.rename(
                currentPath,
                newPath
            );

            const items =
                await listVideos(type);

            const updated =
                items.find(
                    item =>
                        item.filename === filename
                );

            return res.json({
                success: true,
                item: updated || null
            });
        } catch (error) {
            console.error(
                '[VIDEO PRODUCTION RENAME]',
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    'Não foi possível renomear o arquivo.'
            });
        }
    }
);


/*
 * Excluir.
 */
router.delete(
    '/api/:type/:id',
    async (req, res) => {
        try {
            const type =
                String(
                    req.params.type || ''
                );

            if (!isValidType(type)) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Tipo de mídia inválido.'
                });
            }

            const filePath =
                await resolveVideoPath(
                    type,
                    req.params.id
                );

            await fs.unlink(
                filePath
            );

            return res.json({
                success: true
            });
        } catch (error) {
            console.error(
                '[VIDEO PRODUCTION DELETE]',
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    'Não foi possível excluir o arquivo.'
            });
        }
    }
);


module.exports = router;

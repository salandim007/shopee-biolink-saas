'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');


class ReelGeneratorError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'ReelGeneratorError';
        this.code = code;
        this.details = details;
    }
}


function createJobId() {
    return (
        Date.now().toString(36) +
        '-' +
        crypto.randomBytes(4).toString('hex')
    );
}


function normalizeImageUrls(imageUrls) {
    if (!Array.isArray(imageUrls)) {
        throw new ReelGeneratorError(
            'A lista de imagens é obrigatória.',
            'REEL_IMAGES_REQUIRED'
        );
    }

    const normalized = [
        ...new Set(
            imageUrls
                .map(value => String(value || '').trim())
                .filter(Boolean)
        )
    ].slice(0, 5);

    if (normalized.length === 0) {
        throw new ReelGeneratorError(
            'Nenhuma imagem válida foi informada.',
            'REEL_IMAGES_REQUIRED'
        );
    }

    for (const imageUrl of normalized) {
        let parsed;

        try {
            parsed = new URL(imageUrl);
        } catch {
            throw new ReelGeneratorError(
                'Uma das imagens possui URL inválida.',
                'REEL_INVALID_IMAGE_URL'
            );
        }

        if (
            parsed.protocol !== 'https:' &&
            parsed.protocol !== 'http:'
        ) {
            throw new ReelGeneratorError(
                'A imagem precisa usar HTTP ou HTTPS.',
                'REEL_INVALID_IMAGE_URL'
            );
        }
    }

    return normalized;
}


async function downloadImage(
    imageUrl,
    destination,
    fetchImpl
) {
    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            30000
        );

    let response;

    try {
        response =
            await fetchImpl(
                imageUrl,
                {
                    signal:
                        controller.signal
                }
            );
    } catch (error) {
        throw new ReelGeneratorError(
            'Não foi possível baixar uma imagem do produto.',
            'REEL_IMAGE_DOWNLOAD_FAILED'
        );
    } finally {
        clearTimeout(timeout);
    }

    if (!response || !response.ok) {
        throw new ReelGeneratorError(
            'A Shopee não retornou uma das imagens corretamente.',
            'REEL_IMAGE_DOWNLOAD_FAILED',
            {
                status:
                    response?.status ||
                    null
            }
        );
    }

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );

    if (buffer.length === 0) {
        throw new ReelGeneratorError(
            'Uma das imagens baixadas está vazia.',
            'REEL_IMAGE_EMPTY'
        );
    }

    await fs.writeFile(
        destination,
        buffer
    );
}


function buildFilterGraph({
    imageCount,
    width,
    height,
    fps,
    secondsPerImage,
    transitionDuration
}) {
    const filters = [];

    const framesPerImage =
        Math.round(
            secondsPerImage *
            fps
        );

    for (
        let index = 0;
        index < imageCount;
        index += 1
    ) {
        filters.push(
            `[${index}:v]` +
            `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=white,` +
            `zoompan=` +
            `z='min(zoom+0.0007,1.06)':` +
            `x='iw/2-(iw/zoom/2)':` +
            `y='ih/2-(ih/zoom/2)':` +
            `d=${framesPerImage}:` +
            `s=${width}x${height}:` +
            `fps=${fps},` +
            `setsar=1` +
            `[v${index}]`
        );
    }

    if (imageCount === 1) {
        filters.push(
            '[v0]null[vout]'
        );

        return filters.join(';');
    }

    const transitions = [
        'fade',
        'smoothleft',
        'fade',
        'smoothleft'
    ];

    let previous =
        'v0';

    const offsetStep =
        secondsPerImage -
        transitionDuration;

    for (
        let index = 1;
        index < imageCount;
        index += 1
    ) {
        const output =
            index === imageCount - 1
                ? 'vout'
                : `x${index}`;

        const transition =
            transitions[
                (index - 1) %
                transitions.length
            ];

        const offset =
            (
                offsetStep *
                index
            ).toFixed(2);

        filters.push(
            `[${previous}][v${index}]` +
            `xfade=` +
            `transition=${transition}:` +
            `duration=${transitionDuration}:` +
            `offset=${offset}` +
            `[${output}]`
        );

        previous =
            output;
    }

    return filters.join(';');
}


function executeFfmpeg(
    ffmpegPath,
    args
) {
    return new Promise(
        (resolve, reject) => {
            const child =
                spawn(
                    ffmpegPath,
                    args,
                    {
                        windowsHide:
                            true,
                        stdio: [
                            'ignore',
                            'ignore',
                            'pipe'
                        ]
                    }
                );

            let stderr =
                '';

            child.stderr.on(
                'data',
                chunk => {
                    stderr +=
                        chunk.toString();

                    if (
                        stderr.length >
                        16000
                    ) {
                        stderr =
                            stderr.slice(
                                -16000
                            );
                    }
                }
            );

            child.on(
                'error',
                error => {
                    reject(
                        new ReelGeneratorError(
                            error &&
                            error.code === 'ENOENT'
                                ? 'FFmpeg não foi encontrado no sistema.'
                                : 'Não foi possível iniciar o FFmpeg.',
                            'REEL_FFMPEG_START_FAILED'
                        )
                    );
                }
            );

            child.on(
                'close',
                code => {
                    if (code === 0) {
                        resolve();
                        return;
                    }

                    reject(
                        new ReelGeneratorError(
                            'O FFmpeg não conseguiu gerar o Reel.',
                            'REEL_FFMPEG_FAILED',
                            {
                                exitCode:
                                    code,
                                ffmpegOutput:
                                    stderr
                            }
                        )
                    );
                }
            );
        }
    );
}


async function generateReel(options = {}) {
    const fetchImpl =
        options.fetchImpl ||
        globalThis.fetch;

    if (
        typeof fetchImpl !==
        'function'
    ) {
        throw new ReelGeneratorError(
            'Fetch não está disponível.',
            'REEL_FETCH_UNAVAILABLE'
        );
    }

    const imageUrls =
        normalizeImageUrls(
            options.imageUrls
        );

    const ffmpegPath =
        options.ffmpegPath ||
        process.env.FFMPEG_PATH ||
        'ffmpeg';

    const width =
        options.width ||
        1080;

    const height =
        options.height ||
        1920;

    const fps =
        options.fps ||
        30;

    const secondsPerImage =
        options.secondsPerImage ||
        2.6;

    const transitionDuration =
        options.transitionDuration ||
        0.45;

    const rootDirectory =
        options.outputDirectory ||
        path.join(
            process.cwd(),
            'tmp',
            'reels'
        );

    const jobId =
        options.jobId ||
        createJobId();

    const jobDirectory =
        path.join(
            rootDirectory,
            jobId
        );

    await fs.mkdir(
        jobDirectory,
        {
            recursive:
                true
        }
    );

    const localImages = [];

    for (
        let index = 0;
        index < imageUrls.length;
        index += 1
    ) {
        const destination =
            path.join(
                jobDirectory,
                `foto-${index + 1}.jpg`
            );

        await downloadImage(
            imageUrls[index],
            destination,
            fetchImpl
        );

        localImages.push(
            destination
        );
    }

    const outputPath =
        path.join(
            jobDirectory,
            'reel.mp4'
        );

    const filterGraph =
        buildFilterGraph({
            imageCount:
                localImages.length,
            width,
            height,
            fps,
            secondsPerImage,
            transitionDuration
        });

    const args = [
        '-y'
    ];

    for (
        const imagePath
        of localImages
    ) {
        args.push(
            '-i',
            imagePath
        );
    }

    args.push(
        '-filter_complex',
        filterGraph,

        '-map',
        '[vout]',

        '-c:v',
        'libx264',

        '-preset',
        'medium',

        '-crf',
        '20',

        '-pix_fmt',
        'yuv420p',

        '-movflags',
        '+faststart',

        '-r',
        String(fps),

        outputPath
    );

    await executeFfmpeg(
        ffmpegPath,
        args
    );

    const durationSeconds =
        (
            imageUrls.length *
            secondsPerImage
        ) -
        (
            Math.max(
                0,
                imageUrls.length - 1
            ) *
            transitionDuration
        );

    return {
        success:
            true,

        jobId,

        outputPath,

        imageCount:
            imageUrls.length,

        width,

        height,

        fps,

        durationSeconds:
            Number(
                durationSeconds.toFixed(2)
            )
    };
}


module.exports = {
    ReelGeneratorError,
    generateReel,
    buildFilterGraph,
    normalizeImageUrls
};

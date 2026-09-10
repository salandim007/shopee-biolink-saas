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


    /*
     * Fotos do produto.
     */
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


    /*
     * Avatar horizontal adaptado para Reel vertical.
     *
     * Fundo:
     * amplia e desfoca o próprio vídeo.
     *
     * Frente:
     * mantém o avatar inteiro e centralizado.
     */
    filters.push(
        `[${imageCount}:v]split=2[avatarbg][avatarfg]`
    );

    filters.push(
        `[avatarbg]` +
        `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},` +
        `boxblur=20:1` +
        `[avatarbg2]`
    );

    filters.push(
        `[avatarfg]` +
        `scale=${width}:${height}:force_original_aspect_ratio=decrease` +
        `[avatarfg2]`
    );

    filters.push(
        `[avatarbg2][avatarfg2]` +
        `overlay=(W-w)/2:(H-h)/2,` +
        `fps=${fps},` +
        `setsar=1,` +
        `setpts=PTS-STARTPTS` +
        `[vclose]`
    );


    /*
     * Transições entre as fotos.
     */
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
            `x${index}`;

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


    /*
     * Momento em que o avatar começa.
     */
    const productDuration =
        (
            imageCount *
            secondsPerImage
        ) -
        (
            Math.max(
                0,
                imageCount - 1
            ) *
            transitionDuration
        );

    const avatarOffset =
        Math.max(
            0,
            productDuration -
            transitionDuration
        );


    /*
     * Transição suave da última foto para o avatar.
     */
    filters.push(
        `[${previous}][vclose]` +
        `xfade=` +
        `transition=fade:` +
        `duration=${transitionDuration}:` +
        `offset=${avatarOffset.toFixed(2)}` +
        `[vout]`
    );


    /*
     * O áudio do avatar começa somente quando
     * ele aparece no final do Reel.
     */
    const audioDelayMs =
        Math.round(
            avatarOffset *
            1000
        );

    filters.push(
        `[${imageCount}:a]` +
        `asetpts=PTS-STARTPTS,` +
        `adelay=${audioDelayMs}:all=1` +
        `[aout]`
    );


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

    const closingDuration =
        options.closingDuration ||
        10.08;

    const fontFile =
        options.fontFile ||
        (
            process.platform === 'win32'
                ? 'C\\:/Windows/Fonts/arial.ttf'
                : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        );

    const boldFontFile =
        options.boldFontFile ||
        (
            process.platform === 'win32'
                ? 'C\\:/Windows/Fonts/arialbd.ttf'
                : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
        );

    const avatarPath =
        options.avatarPath ||
        path.join(
            process.cwd(),
            'assets',
            'video',
            'avatar.mp4'
        );

    try {
        await fs.access(
            avatarPath
        );
    } catch {
        throw new ReelGeneratorError(
            'O vídeo do avatar não foi encontrado.',
            'REEL_AVATAR_NOT_FOUND',
            {
                avatarPath
            }
        );
    }


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
            transitionDuration,
            closingDuration,
            fontFile,
            boldFontFile
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


    /*
     * Avatar com vídeo + áudio.
     */
    args.push(
        '-i',
        avatarPath
    );


    args.push(
        '-filter_complex',
        filterGraph,

        '-map',
        '[vout]',

        '-map',
        '[aout]',

        '-c:v',
        'libx264',

        '-c:a',
        'aac',

        '-b:a',
        '192k',

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

    const productDuration =
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

    const durationSeconds =
        productDuration +
        closingDuration -
        transitionDuration;

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

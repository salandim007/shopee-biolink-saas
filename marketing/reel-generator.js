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


async function resolveBackgroundMusic(options = {}) {
    const explicitPath =
        String(
            options.musicPath ||
            ''
        ).trim();

    if (
        Object.prototype.hasOwnProperty.call(
            options,
            'musicPath'
        ) &&
        !explicitPath
    ) {
        return null;
    }

    if (explicitPath) {
        const resolved =
            path.resolve(
                explicitPath
            );

        try {
            await fs.access(
                resolved
            );
        } catch {
            throw new ReelGeneratorError(
                'A música de fundo informada não foi encontrada.',
                'REEL_MUSIC_NOT_FOUND',
                {
                    musicPath:
                        resolved
                }
            );
        }

        return resolved;
    }


    const defaultMusicPath =
        path.resolve(
            process.env.REEL_MUSIC_PATH ||
            path.join(
                process.cwd(),
                'data',
                'music',
                'pixabay',
                'bombinsound-no-copyright-vlog-499473.mp3'
            )
        );


    try {
        await fs.access(
            defaultMusicPath
        );
    } catch {
        return null;
    }


    return defaultMusicPath;
}


function buildFilterGraph({
    imageCount,
    width,
    height,
    fps,
    secondsPerImage,
    transitionDuration,
    closingInputIndex = imageCount,
    musicInputIndex = null,
    totalDuration = null,
    musicVolume = 0.16
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
    if (closingInputIndex !== null) {
        filters.push(
            `[${closingInputIndex}:v]split=2[avatarbg][avatarfg]`
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
    }


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

    if (closingInputIndex === null) {
        filters.push(
            `[${previous}]null[vout]`
        );

        const safeDuration =
            Math.max(
                1,
                Number(totalDuration) ||
                productDuration ||
                1
            );

        if (musicInputIndex !== null) {
            filters.push(
                `[${musicInputIndex}:a]` +
                `asetpts=PTS-STARTPTS,` +
                `volume=${musicVolume},` +
                `atrim=0:${safeDuration.toFixed(3)},` +
                `aresample=48000,` +
                `aformat=channel_layouts=stereo` +
                `[aout]`
            );
        } else {
            filters.push(
                `anullsrc=r=48000:cl=stereo,` +
                `atrim=duration=${safeDuration.toFixed(3)},` +
                `asetpts=PTS-STARTPTS[aout]`
            );
        }

        return filters.join(';');
    }


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

    const avatarAudioLabel =
        musicInputIndex === null
            ? 'aout'
            : 'avatarAudio';


    filters.push(
        `[${closingInputIndex}:a]` +
        `asetpts=PTS-STARTPTS,` +
        `adelay=${audioDelayMs}:all=1` +
        `[${avatarAudioLabel}]`
    );


    /*
     * Música de fundo:
     * começa no segundo zero,
     * permanece durante todo o Reel,
     * volume reduzido,
     * fade suave no início e no final.
     */
    if (
        musicInputIndex !==
        null
    ) {
        const safeDuration =
            Math.max(
                1,
                Number(
                    totalDuration
                ) || 1
            );

        const safeVolume =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(
                        musicVolume
                    ) || 0.16
                )
            );

        const fadeInDuration =
            Math.min(
                0.6,
                safeDuration / 4
            );

        const fadeOutDuration =
            Math.min(
                0.9,
                safeDuration / 4
            );

        const fadeOutStart =
            Math.max(
                0,
                safeDuration -
                fadeOutDuration
            );


        filters.push(
            `[${musicInputIndex}:a]` +
            `asetpts=PTS-STARTPTS,` +
            `volume=${safeVolume.toFixed(3)},` +
            `atrim=0:${safeDuration.toFixed(3)},` +
            `afade=t=in:st=0:d=${fadeInDuration.toFixed(3)},` +
            `afade=t=out:st=${fadeOutStart.toFixed(3)}:` +
            `d=${fadeOutDuration.toFixed(3)}` +
            `[musicbg]`
        );


        filters.push(
            `[avatarAudio][musicbg]` +
            `amix=inputs=2:` +
            `duration=longest:` +
            `dropout_transition=0,` +
            `atrim=0:${safeDuration.toFixed(3)}` +
            `[aout]`
        );
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


async function probeReelMedia(
    filePath,
    ffprobePath = 'ffprobe'
) {
    return new Promise(
        (resolve, reject) => {
            const child =
                spawn(
                    ffprobePath,
                    [
                        '-v',
                        'error',

                        '-show_entries',
                        'format=duration:stream=codec_type',

                        '-of',
                        'json',

                        filePath
                    ],
                    {
                        windowsHide:
                            true,

                        stdio: [
                            'ignore',
                            'pipe',
                            'pipe'
                        ]
                    }
                );

            let stdout = '';
            let stderr = '';

            child.stdout.on(
                'data',
                chunk => {
                    stdout +=
                        chunk.toString();
                }
            );

            child.stderr.on(
                'data',
                chunk => {
                    stderr +=
                        chunk.toString();
                }
            );

            child.on(
                'error',
                error => {
                    reject(
                        new ReelGeneratorError(
                            'Não foi possível iniciar o FFprobe.',
                            'REEL_MEDIA_PROBE_FAILED',
                            {
                                message:
                                    error.message
                            }
                        )
                    );
                }
            );

            child.on(
                'close',
                code => {
                    if (code !== 0) {
                        reject(
                            new ReelGeneratorError(
                                'Não foi possível analisar o vídeo selecionado.',
                                'REEL_MEDIA_PROBE_FAILED',
                                {
                                    ffprobeOutput:
                                        stderr.slice(
                                            -2000
                                        )
                                }
                            )
                        );

                        return;
                    }

                    try {
                        const info =
                            JSON.parse(
                                stdout
                            );

                        const duration =
                            Number(
                                info.format
                                    ?.duration
                            );

                        if (
                            !Number.isFinite(
                                duration
                            ) ||
                            duration <= 0
                        ) {
                            throw new Error(
                                'Duração inválida.'
                            );
                        }

                        const hasAudio =
                            (
                                info.streams ||
                                []
                            ).some(
                                stream =>
                                    stream.codec_type ===
                                    'audio'
                            );

                        resolve({
                            duration,
                            hasAudio
                        });
                    } catch (error) {
                        reject(
                            new ReelGeneratorError(
                                'O vídeo selecionado não possui duração válida.',
                                'REEL_INVALID_MEDIA',
                                {
                                    message:
                                        error.message
                                }
                            )
                        );
                    }
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

    let closingDuration =
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

    const hasClosingOption =
        Object.prototype.hasOwnProperty.call(
            options,
            'closingPath'
        );

    const closingEnabled =
        hasClosingOption
            ? Boolean(options.closingPath)
            : true;

    if (!closingEnabled) {
        closingDuration = 0;
    }

    const avatarPath =
        closingEnabled
            ? (
                options.closingPath ||
                options.avatarPath ||
                path.join(
                    process.cwd(),
                    'assets',
                    'video',
                    'avatar.mp4'
                )
            )
            : null;

    if (closingEnabled) {
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
    }


    const ffprobePath =
        options.ffprobePath ||
        process.env.FFPROBE_PATH ||
        'ffprobe';

    const introPath =
        options.introPath
            ? path.resolve(
                options.introPath
            )
            : null;

    let introInfo = null;

    if (introPath) {
        try {
            await fs.access(
                introPath
            );
        } catch {
            throw new ReelGeneratorError(
                'O vídeo de abertura não foi encontrado.',
                'REEL_INTRO_NOT_FOUND',
                {
                    introPath
                }
            );
        }

        introInfo =
            await probeReelMedia(
                introPath,
                ffprobePath
            );
    }

    if (
        closingEnabled &&
        options.closingPath &&
        !options.closingDuration
    ) {
        const closingInfo =
            await probeReelMedia(
                avatarPath,
                ffprobePath
            );

        closingDuration =
            closingInfo.duration;
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
        closingEnabled
            ? (
                productDuration +
                closingDuration -
                transitionDuration
            )
            : productDuration;

    const musicPath =
        await resolveBackgroundMusic(
            options
        );


    if (musicPath) {
        console.log(
            '[REEL MUSIC] Trilha selecionada:',
            path.basename(
                musicPath
            )
        );
    } else {
        console.log(
            '[REEL MUSIC] Nenhuma trilha local disponível.'
        );
    }


    const musicInputIndex =
        musicPath
            ? (
                localImages.length +
                (closingEnabled ? 1 : 0) +
                (introInfo ? 1 : 0)
            )
            : null;


    const outputPath =
        path.join(
            jobDirectory,
            'reel.mp4'
        );

    let filterGraph =
        buildFilterGraph({
            imageCount:
                localImages.length,
            width,
            height,
            fps,
            secondsPerImage,
            transitionDuration,
            closingInputIndex:
                closingEnabled
                    ? localImages.length
                    : null,
            closingDuration,
            fontFile,
            boldFontFile,
            musicInputIndex,
            totalDuration:
                durationSeconds,
            musicVolume:
                0.16
        });

    if (introInfo) {
        const introInputIndex =
            localImages.length +
            (closingEnabled ? 1 : 0);

        const introDuration =
            introInfo.duration
                .toFixed(3);

        /*
         * Abertura:
         * normaliza para o mesmo padrão
         * vertical do Reel.
         */
        filterGraph +=
            `;[${introInputIndex}:v]` +
            `fps=${fps},` +
            `scale=${width}:${height}:` +
            `force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:` +
            `(ow-iw)/2:(oh-ih)/2:color=black,` +
            `setsar=1,` +
            `format=yuv420p,` +
            `trim=duration=${introDuration},` +
            `setpts=PTS-STARTPTS` +
            `[openingVideo]`;

        /*
         * Une:
         * abertura -> fotos -> fechamento.
         */
        filterGraph +=
            ';[openingVideo][vout]' +
            'concat=n=2:v=1:a=0' +
            '[productionVideo]';

        /*
         * Áudio da abertura.
         *
         * Se não houver áudio no arquivo,
         * gera silêncio com a mesma duração.
         */
        if (introInfo.hasAudio) {
            filterGraph +=
                `;[${introInputIndex}:a]` +
                `atrim=duration=${introDuration},` +
                `asetpts=PTS-STARTPTS,` +
                `aresample=48000,` +
                `aformat=channel_layouts=stereo` +
                `[openingAudio]`;
        } else {
            filterGraph +=
                ';anullsrc=' +
                'r=48000:cl=stereo,' +
                `atrim=duration=${introDuration},` +
                'asetpts=PTS-STARTPTS' +
                '[openingAudio]';
        }

        /*
         * Normaliza também o áudio do Reel
         * antes da concatenação.
         */
        filterGraph +=
            ';[aout]' +
            'aresample=48000,' +
            'aformat=channel_layouts=stereo,' +
            'asetpts=PTS-STARTPTS' +
            '[reelAudio]';

        filterGraph +=
            ';[openingAudio][reelAudio]' +
            'concat=n=2:v=0:a=1' +
            '[productionAudio]';
    }


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
     * Fechamento opcional.
     */
    if (closingEnabled) {
        args.push(
            '-i',
            avatarPath
        );
    }


    if (introPath) {
        args.push(
            '-i',
            introPath
        );
    }


    if (musicPath) {
        args.push(
            '-stream_loop',
            '-1',
            '-i',
            musicPath
        );
    }


    args.push(
        '-filter_complex',
        filterGraph,

        '-map',
        introInfo
            ? '[productionVideo]'
            : '[vout]',

        '-map',
        introInfo
            ? '[productionAudio]'
            : '[aout]',

        '-c:v',
        'libx264',

        '-c:a',
        'aac',

        '-b:a',
        '128k',

        '-ar',
        '48000',

        '-ac',
        '2',

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
                (
                    durationSeconds +
                    (
                        introInfo
                            ?.duration ||
                        0
                    )
                ).toFixed(2)
            ),

        introIncluded:
            Boolean(
                introInfo
            ),

        introDurationSeconds:
            introInfo
                ? Number(
                    introInfo.duration
                        .toFixed(2)
                )
                : 0,

        closingDurationSeconds:
            Number(
                Number(
                    closingDuration
                ).toFixed(2)
            ),

        musicEnabled:
            Boolean(
                musicPath
            ),

        musicTrack:
            musicPath
                ? path.basename(
                    musicPath
                )
                : null
    };
}


module.exports = {
    ReelGeneratorError,
    generateReel,
    buildFilterGraph,
    normalizeImageUrls
};

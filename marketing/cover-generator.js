'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const { getCoverTemplateById } =
    require('./cover-template-library');

const OUTPUT_DIR = path.join(
    process.cwd(),
    'data',
    'video-production',
    'covers'
);

function text(value, fallback = '') {
    const result = String(value ?? '').trim();
    return result || fallback;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function ensureOutputDir() {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
}


function wrapText(
    value,
    maxChars = 18,
    maxLines = 2
) {
    const words =
        text(value)
            .split(/\s+/)
            .filter(Boolean);

    const lines = [];
    let current = '';

    for (const word of words) {
        const candidate =
            current
                ? `${current} ${word}`
                : word;

        if (
            candidate.length <= maxChars ||
            !current
        ) {
            current = candidate;
            continue;
        }

        lines.push(current);
        current = word;

        if (
            lines.length === maxLines - 1
        ) {
            break;
        }
    }

    if (
        current &&
        lines.length < maxLines
    ) {
        lines.push(current);
    }

    const used =
        lines.join(' ').length;

    const original =
        text(value);

    if (
        original.length > used &&
        lines.length
    ) {
        lines[lines.length - 1] =
            lines[lines.length - 1]
                .replace(/[.,;:!?-]+$/g, '');

        lines[lines.length - 1] += '…';
    }

    return lines;
}


function headlineFontSize(lines) {
    const longest =
        Math.max(
            ...lines.map(
                line => line.length
            ),
            1
        );

    if (longest <= 12) return 92;
    if (longest <= 16) return 80;
    if (longest <= 20) return 68;

    return 58;
}


function normalizePriceLabel(value) {
    const price =
        text(value);

    if (!price) {
        return '';
    }

    if (
        /^(r\$|us\$|\$|€)/i.test(price)
    ) {
        return price;
    }

    if (
        /^[0-9.,]+$/.test(price)
    ) {
        return `R$ ${price}`;
    }

    return price;
}


async function remoteImageToDataUri(url) {
    const source =
        text(url);

    if (!source) {
        return '';
    }

    if (
        source.startsWith('data:image/')
    ) {
        return source;
    }

    if (
        !/^https?:\/\//i.test(source)
    ) {
        return '';
    }

    try {
        const response =
            await fetch(
                source,
                {
                    redirect: 'follow',
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 MixDeProdutos-Cover/1.0',
                        'Accept':
                            'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                    }
                }
            );

        if (!response.ok) {
            return '';
        }

        const buffer =
            Buffer.from(
                await response.arrayBuffer()
            );

        if (
            !buffer.length ||
            buffer.length > 15 * 1024 * 1024
        ) {
            return '';
        }

        let contentType =
            String(
                response.headers.get(
                    'content-type'
                ) || 'image/jpeg'
            )
                .split(';')[0]
                .trim();

        if (
            !contentType.startsWith('image/')
        ) {
            contentType =
                'image/jpeg';
        }

        return (
            `data:${contentType};base64,` +
            buffer.toString('base64')
        );
    } catch (error) {
        console.warn(
            '[COVER IMAGE]',
            error.message
        );

        return '';
    }
}



const COVER_PALETTES = Object.freeze({
    coral: {
        bg1: '#ff8a78',
        bg2: '#ffb36b',
        bg3: '#ffe0a3',
        panel: '#ef476f',
        band1: '#4878d0',
        band2: '#6ea8e8',
        accent: '#d92f55'
    },

    azul: {
        bg1: '#8ecae6',
        bg2: '#bde0fe',
        bg3: '#e7f5ff',
        panel: '#3a86c8',
        band1: '#2457a6',
        band2: '#4d8bd6',
        accent: '#176b9b'
    },

    menta: {
        bg1: '#9be8c8',
        bg2: '#c8f1d8',
        bg3: '#f0f8d7',
        panel: '#31a87a',
        band1: '#278c80',
        band2: '#55b9a5',
        accent: '#16866a'
    },

    lilas: {
        bg1: '#c9a7eb',
        bg2: '#e5c9f2',
        bg3: '#f6e6ff',
        panel: '#8e5bc7',
        band1: '#6650b8',
        band2: '#9182db',
        accent: '#7845ab'
    },

    dourado: {
        bg1: '#efd49a',
        bg2: '#f7e6bc',
        bg3: '#fff6df',
        panel: '#c58b3c',
        band1: '#8d7048',
        band2: '#ba9663',
        accent: '#a96f27'
    }
});


function getCoverPalette(id) {
    return (
        COVER_PALETTES[
            String(id || '').trim()
        ] ||
        COVER_PALETTES.coral
    );
}


async function buildOfertaForteSvg(
    data = {},
    template
) {
    const width =
        template.width || 1280;

    const height =
        template.height || 720;

    const palette =
        getCoverPalette(
            data.paletteId
        );

    const headlineLines =
        wrapText(
            text(
                data.headline,
                template.defaults?.headline ||
                    'ACHADO IMPERDÍVEL!'
            ).toUpperCase(),
            18,
            2
        );

    const headlineSize =
        Math.min(
            headlineFontSize(headlineLines),
            82
        );

    const subheadlineLines =
        wrapText(
            text(
                data.subheadline,
                template.defaults?.subheadline ||
                    'VEJA ESSE PRODUTO'
            ).toUpperCase(),
            27,
            2
        );

    const badge =
        escapeHtml(
            text(
                data.badge,
                template.defaults?.badge ||
                    'TOP OFERTA'
            ).toUpperCase()
        );

    const cta =
        escapeHtml(
            text(
                data.cta,
                template.defaults?.cta ||
                    'CONFIRA AGORA'
            ).toUpperCase()
        );

    const price =
        escapeHtml(
            normalizePriceLabel(
                data.price
            )
        );

    const productImage =
        await remoteImageToDataUri(
            data.productImage
        );

    const headlineSvg =
        headlineLines
            .map(
                (line, index) => `
                <text
                    x="82"
                    y="${225 + index * (headlineSize + 4)}"
                    font-family="Impact, DejaVu Sans, sans-serif"
                    font-size="${headlineSize}"
                    font-weight="900"
                    fill="${index === 0 ? '#ffffff' : '#ffe600'}"
                    stroke="#111111"
                    stroke-width="12"
                    stroke-linejoin="round"
                    paint-order="stroke fill"
                    filter="url(#strongShadow)"
                >${escapeHtml(line)}</text>`
            )
            .join('');

    const subheadlineSvg =
        subheadlineLines
            .map(
                (line, index) => `
                <text
                    x="105"
                    y="${455 + index * 39}"
                    font-family="DejaVu Sans, sans-serif"
                    font-size="31"
                    font-weight="900"
                    fill="#ffffff"
                    stroke="#00318d"
                    stroke-width="2"
                    paint-order="stroke fill"
                >${escapeHtml(line)}</text>`
            )
            .join('');

    const priceBlock =
        price
            ? `
            <g
                transform="rotate(4 595 565)"
                filter="url(#strongShadow)"
            >
                <rect
                    x="468"
                    y="510"
                    width="270"
                    height="118"
                    rx="22"
                    fill="#ffe500"
                    stroke="#111111"
                    stroke-width="7"
                />

                <text
                    x="493"
                    y="548"
                    font-family="DejaVu Sans, sans-serif"
                    font-size="22"
                    font-weight="900"
                    fill="#111111"
                >OFERTA</text>

                <text
                    x="492"
                    y="602"
                    font-family="Impact, DejaVu Sans, sans-serif"
                    font-size="48"
                    font-weight="900"
                    fill="#111111"
                >${price}</text>
            </g>`
            : '';

    const imageBlock =
        productImage
            ? `
            <g
                transform="rotate(3 1010 350)"
                filter="url(#productShadow)"
            >
                <rect
                    x="786"
                    y="72"
                    width="445"
                    height="535"
                    rx="34"
                    fill="#ffffff"
                    stroke="#ffffff"
                    stroke-width="11"
                />

                <image
                    href="${productImage}"
                    x="801"
                    y="87"
                    width="415"
                    height="505"
                    preserveAspectRatio="xMidYMid meet"
                />
            </g>

            <g
                transform="rotate(-7 1150 110)"
                filter="url(#softShadow)"
            >
                <circle
                    cx="1150"
                    cy="110"
                    r="56"
                    fill="#ff0026"
                    stroke="#ffffff"
                    stroke-width="6"
                />

                <text
                    x="1150"
                    y="102"
                    text-anchor="middle"
                    font-family="DejaVu Sans, sans-serif"
                    font-size="18"
                    font-weight="900"
                    fill="#ffffff"
                >PRODUTO</text>

                <text
                    x="1150"
                    y="128"
                    text-anchor="middle"
                    font-family="DejaVu Sans, sans-serif"
                    font-size="22"
                    font-weight="900"
                    fill="#ffe600"
                >DESTAQUE</text>
            </g>`
            : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 1280 720"
>
    <defs>
        <linearGradient
            id="background"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
        >
            <stop offset="0%" stop-color="${palette.bg1}"/>
            <stop offset="52%" stop-color="${palette.bg2}"/>
            <stop offset="100%" stop-color="${palette.bg3}"/>
        </linearGradient>

        <linearGradient
            id="blueBand"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
        >
            <stop offset="0%" stop-color="${palette.band1}"/>
            <stop offset="100%" stop-color="${palette.band2}"/>
        </linearGradient>

        <filter id="strongShadow">
            <feDropShadow
                dx="8"
                dy="10"
                stdDeviation="5"
                flood-color="#000000"
                flood-opacity=".60"
            />
        </filter>

        <filter id="softShadow">
            <feDropShadow
                dx="5"
                dy="7"
                stdDeviation="5"
                flood-color="#000000"
                flood-opacity=".42"
            />
        </filter>

        <filter id="productShadow">
            <feDropShadow
                dx="5"
                dy="16"
                stdDeviation="15"
                flood-color="#000000"
                flood-opacity=".45"
            />
        </filter>
    </defs>

    <!-- FUNDO -->
    <rect
        width="1280"
        height="720"
        fill="url(#background)"
    />

    <path
        d="M780 0 L1280 0 L1280 720 L1000 720 Z"
        fill="#ffd400"
        opacity=".27"
    />

    <circle
        cx="1160"
        cy="80"
        r="240"
        fill="#ffffff"
        opacity=".09"
    />

    <circle
        cx="1010"
        cy="650"
        r="280"
        fill="#ff0020"
        opacity=".13"
    />

    <!-- RAIOS DECORATIVOS -->
    <g opacity=".75">
        <path
            d="M700 115 L755 95 L725 155 Z"
            fill="#ffe600"
        />

        <path
            d="M730 185 L790 180 L748 225 Z"
            fill="#ffffff"
        />

        <path
            d="M695 275 L760 300 L700 320 Z"
            fill="#ff0020"
        />
    </g>

    <!-- MARCA -->
    <g
        transform="rotate(-2 190 78)"
        filter="url(#softShadow)"
    >
        <rect
            x="66"
            y="49"
            width="252"
            height="54"
            rx="27"
            fill="#ffffff"
        />

        <text
            x="88"
            y="85"
            font-family="DejaVu Sans, sans-serif"
            font-size="23"
            font-weight="900"
            fill="#ff3b00"
        >MIX DE PRODUTOS</text>
    </g>

    <!-- HEADLINE INCLINADA -->
    <g
        transform="rotate(-4 350 270)"
    >
        <path
            d="M48 142
               L705 118
               L739 350
               L65 374 Z"
            fill="${palette.panel}"
            opacity=".95"
        />

        <path
            d="M53 152
               L710 128"
            stroke="#ffe600"
            stroke-width="9"
        />

        ${headlineSvg}
    </g>

    <!-- FAIXA DO SUBTÍTULO -->
    <g
        transform="rotate(-5 350 455)"
        filter="url(#softShadow)"
    >
        <path
            d="M58 405
               L735 378
               L713 500
               L42 530 Z"
            fill="url(#blueBand)"
        />

        ${subheadlineSvg}
    </g>

    <!-- SELO -->
    <g
        transform="rotate(-7 260 570)"
        filter="url(#strongShadow)"
    >
        <path
            d="M73 523
               H338
               L390 565
               L338 607
               H73
               L92 565
               Z"
            fill="${palette.accent}"
            stroke="#ffffff"
            stroke-width="6"
        />

        <text
            x="125"
            y="578"
            font-family="Impact, DejaVu Sans, sans-serif"
            font-size="38"
            font-weight="900"
            fill="#ffffff"
        >${badge}</text>
    </g>

    ${priceBlock}

    <!-- CTA -->
    <g
        transform="rotate(-3 280 665)"
        filter="url(#strongShadow)"
    >
        <rect
            x="70"
            y="625"
            width="425"
            height="70"
            rx="35"
            fill="${palette.accent}"
            stroke="#ffffff"
            stroke-width="6"
        />

        <text
            x="282"
            y="671"
            text-anchor="middle"
            font-family="DejaVu Sans, sans-serif"
            font-size="30"
            font-weight="900"
            fill="#ffffff"
        >${cta}</text>

        <path
            d="M462 643
               L480 660
               L462 677"
            fill="none"
            stroke="#ffe600"
            stroke-width="8"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    </g>

    ${imageBlock}
</svg>`;
}


async function generateCover(options = {}) {
    const templateId =
        text(options.templateId, 'oferta-forte');

    const template =
        getCoverTemplateById(templateId);

    if (!template) {
        throw new Error('Template de capa não encontrado.');
    }

    await ensureOutputDir();

    const jobId =
        `cover-${crypto.randomBytes(6).toString('hex')}`;

    const svg =
        await buildOfertaForteSvg(
            options,
            template
        );

    const outputPath =
        path.join(OUTPUT_DIR, `${jobId}.svg`);

    await fs.writeFile(outputPath, svg, 'utf8');

    return {
        success: true,
        jobId,
        templateId,
        outputPath,
        filename: path.basename(outputPath)
    };
}

module.exports = {
    OUTPUT_DIR,
    ensureOutputDir,
    generateCover
};

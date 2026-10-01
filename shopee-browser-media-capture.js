'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_EXECUTABLE_PATH =
    process.env.CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const MIN_IMAGES = 5;
const MAX_IMAGES = 15;
const MAX_CAPTURE_MS = 15000;
const SETTLE_MS = 500;
const POLL_MS = 150;


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function clean(value) {
    return String(value || '').trim();
}


function isGalleryCandidate(value) {
    const url = clean(value);

    if (
        !/https?:\/\/[^/]*img\.susercontent\.com\/file\//i.test(url)
    ) {
        return false;
    }

    return (
        /_tn(?:\?|$)/i.test(url) ||
        /@resize_w(?:82|164)_nl(?:\.webp)?(?:\?|$)/i.test(url)
    );
}


function normalizeImageUrl(value) {
    let url = clean(value);

    if (!url) {
        return null;
    }

    url = url.split('?')[0];

    url = url
        .replace(
            /@resize_w\d+_nl(?:\.webp)?$/i,
            ''
        )
        .replace(
            /_tn$/i,
            ''
        );

    return url || null;
}


function addGalleryImage(images, value) {
    if (!isGalleryCandidate(value)) {
        return false;
    }

    const normalized =
        normalizeImageUrl(value);

    if (!normalized) {
        return false;
    }

    const previousSize =
        images.size;

    images.add(normalized);

    return (
        images.size >
        previousSize
    );
}


async function collectDomImages(
    page,
    images
) {
    const urls =
        await page.evaluate(() => {
            const found =
                new Set();

            for (
                const img
                of document.images
            ) {
                if (img.src) {
                    found.add(
                        img.src
                    );
                }

                if (img.currentSrc) {
                    found.add(
                        img.currentSrc
                    );
                }

                const srcset =
                    img.getAttribute(
                        'srcset'
                    );

                if (srcset) {
                    for (
                        const part
                        of srcset.split(',')
                    ) {
                        const url =
                            part
                                .trim()
                                .split(/\s+/)[0];

                        if (url) {
                            found.add(
                                url
                            );
                        }
                    }
                }
            }

            return [
                ...found
            ];
        });

    for (
        const url
        of urls
    ) {
        addGalleryImage(
            images,
            url
        );
    }
}


async function captureShopeeMedia(
    shopId,
    itemId
) {
    shopId =
        clean(shopId);

    itemId =
        clean(itemId);

    if (
        !shopId ||
        !itemId
    ) {
        throw new Error(
            'shopId e itemId são obrigatórios.'
        );
    }

    const productUrl =
        `https://shopee.com.br/product/${shopId}/${itemId}`;

    const outputDir =
        path.join(
            __dirname,
            'tmp',
            'shopee-browser-media-capture',
            `${shopId}-${itemId}`
        );

    fs.mkdirSync(
        outputDir,
        {
            recursive: true
        }
    );

    const images =
        new Set();

    const videos =
        new Set();

    let browser = null;
    let page = null;

    let blocked = false;
    let finalUrl =
        productUrl;

    let enoughAt = null;

    const totalStartedAt =
        Date.now();

    let captureStartedAt =
        null;

    try {
        browser =
            await puppeteer.connect({
                browserURL:
                    'http://127.0.0.1:9222',

                defaultViewport:
                    null
            });

        page =
            await browser.newPage();

        await page.setViewport({
            width: 1366,
            height: 900
        });

        page.on(
            'response',
            response => {
                try {
                    const url =
                        response.url();

                    addGalleryImage(
                        images,
                        url
                    );

                    if (
                        /\.(mp4|m3u8)(?:\?|$)/i.test(
                            url
                        )
                    ) {
                        videos.add(
                            url
                        );
                    }
                } catch {
                }
            }
        );

        let lastImageCount =
            images.size;

        captureStartedAt =
            Date.now();

        await page.goto(
            productUrl,
            {
                waitUntil:
                    'domcontentloaded',

                timeout:
                    MAX_CAPTURE_MS
            }
        ).catch(
            () => null
        );

        while (
            Date.now() -
            captureStartedAt <
            MAX_CAPTURE_MS
        ) {
            try {
                finalUrl =
                    page.url();

                if (
                    /\/verify\/traffic\/error/i.test(
                        finalUrl
                    )
                ) {
                    blocked =
                        true;
                }

                await collectDomImages(
                    page,
                    images
                );
            } catch {
            }

            const currentImageCount =
                images.size;

            if (
                currentImageCount !==
                lastImageCount
            ) {
                lastImageCount =
                    currentImageCount;

                if (
                    currentImageCount >=
                    MIN_IMAGES
                ) {
                    enoughAt =
                        Date.now();
                }
            }

            if (
                currentImageCount >=
                MAX_IMAGES
            ) {
                break;
            }

            if (
                currentImageCount >=
                    MIN_IMAGES &&
                enoughAt &&
                Date.now() -
                    enoughAt >=
                    SETTLE_MS
            ) {
                break;
            }

            await sleep(
                POLL_MS
            );
        }

        try {
            finalUrl =
                page.url();
        } catch {
        }

    } finally {

        if (page) {
            try {
                await page.close({
                    runBeforeUnload:
                        false
                });
            } catch {
            }
        }

        if (browser) {
            try {
                browser.disconnect();
            } catch {
            }
        }
    }

    const finalImages =
        [
            ...images
        ].slice(
            0,
            MAX_IMAGES
        );

    const report = {
        shopId,

        itemId,

        productUrl,

        capturedAt:
            new Date()
                .toISOString(),

        elapsedMs:
            Date.now() -
            totalStartedAt,

        images:
            finalImages,

        videos:
            [
                ...videos
            ],

        blocked,

        finalUrl,

        metadata: {
            imageCount:
                finalImages.length,

            videoCount:
                videos.size,

            minImages:
                MIN_IMAGES,

            maxImages:
                MAX_IMAGES,

            maxCaptureMs:
                MAX_CAPTURE_MS,

            stoppedEarly:
                finalImages.length >=
                MIN_IMAGES
        }
    };

    const reportFile =
        path.join(
            outputDir,
            'report.json'
        );

    fs.writeFileSync(
        reportFile,
        JSON.stringify(
            report,
            null,
            2
        ),
        'utf8'
    );

    return {
        ...report,
        reportFile
    };
}


async function main() {
    const shopId =
        process.argv[2];

    const itemId =
        process.argv[3];

    if (
        !shopId ||
        !itemId
    ) {
        console.error(
            'Uso: node shopee-browser-media-capture.js <shopId> <itemId>'
        );

        process.exitCode =
            1;

        return;
    }

    try {
        console.log(
            'Captura rápida iniciada...'
        );

        const result =
            await captureShopeeMedia(
                shopId,
                itemId
            );

        console.log(
            JSON.stringify(
                result,
                null,
                2
            )
        );

    } catch (error) {

        console.error(
            'Falha na captura:',
            error?.message ||
            error
        );

        process.exitCode =
            1;
    }
}


if (
    require.main ===
    module
) {
    main();
}


module.exports = {
    captureShopeeMedia,
    normalizeImageUrl,
    isGalleryCandidate
};

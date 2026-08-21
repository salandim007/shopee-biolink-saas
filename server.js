const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer-core');
const { URL } = require('url');

const { defaultVitrine2Router } = require('./vitrine2-routes');

const app = express();
const PORT = process.env.PORT || 3000;
const CHROME_EXECUTABLE_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/vitrine2', defaultVitrine2Router);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Erro ao conectar ao SQLite:', err.message);
    else console.log('Banco de dados SQLite conectado em', dbPath);
});

// FUNÇÃO CORRIGIDA: Agora ela junta os dados recebidos e resolve a Promise com o HTML
function fetchHtml(pageUrl, retries = 2) {
    return new Promise((resolve, reject) => {
        try {
            const urlObj = new URL(pageUrl);
            const client = urlObj.protocol === 'https:' ? https : http;
            const request = client.get(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9, */*;q=0.8'
                }
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, urlObj).toString();
                    return resolve(fetchHtml(redirectUrl));
                }

                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => { resolve(body); });
            });
            request.on('error', (err) => {
                if (retries > 0 && ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err.code)) {
                    return setTimeout(() => {
                        fetchHtml(pageUrl, retries - 1).then(resolve).catch(reject);
                    }, 500);
                }
                reject(err);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function getMetaContent(html, name) {
    const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
    const match = regex.exec(html);
    return match ? match[1].trim() : '';
}

function parseJsonLd(html) {
    const scripts = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
    for (const match of scripts) {
        try {
            const json = JSON.parse(match[1].trim());
            if (json && (json['@type'] === 'Product' || Array.isArray(json))) {
                return json;
            }
        } catch (error) {
            continue;
        }
    }
    return null;
}

function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function ensureCategory(categoryName, callback) {
    const name = String(categoryName || '').trim();
    if (!name) {
        return callback(null, 1);
    }
    const slug = slugify(name);
    db.get('SELECT id FROM categorias WHERE slug = ?', [slug], (err, row) => {
        if (err) return callback(err);
        if (row) return callback(null, row.id);
        db.run('INSERT INTO categorias (nome, slug) VALUES (?, ?)', [name, slug], function (err) {
            if (err) return callback(err);
            callback(null, this.lastID);
        });
    });
}

function cleanPrice(value) {
    if (!value) return '';
    let str = String(value).replace(/[R$\s]/g, '').trim();
    if (!str) return '';
    if (str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if ((str.match(/\./g) || []).length > 1) {
        str = str.replace(/\.(?=.*\.)/g, '');
    }
    const number = parseFloat(str);
    return Number.isFinite(number) ? number.toString() : '';
}
// ============================================================
// RECEBE O JSON REAL CAPTURADO NO NAVEGADOR
// ============================================================

app.post('/api/shopee/capture', (req, res) => {
    try {
        const {
            shopeeData,
            linkAfiliado,
            marketplace,
            urlOriginal,
            usuario_id
        } = req.body;

        if (!shopeeData?.data?.item) {
            throw new Error(
                'JSON da Shopee inválido: data.item não encontrado.'
            );
        }

        if (!linkAfiliado) {
            throw new Error(
                'Link de afiliado não informado.'
            );
        }

        const normalized =
            normalizeShopeeProductData(shopeeData);

        const usuarioId =
            Number(usuario_id) || 1;

        const marketplaceFinal =
            marketplace || 'shopee';

        const linkAfiliadoFinal =
            String(linkAfiliado).trim();

        const urlOriginalFinal =
            normalizeShopeeUrl(
                urlOriginal || ''
            );

        // =========================================
        // PREÇOS REAIS
        // =========================================

        const precoMinimo =
            normalized.precos.minimo ??
            normalized.precos.atual ??
            0;

        const precoMaximo =
            normalized.precos.maximo ??
            normalized.precos.atual ??
            precoMinimo;

        const precoOferta =
            precoMinimo;

        const precoOriginal =
            normalized.precos.anterior ??
            normalized.precos.maximo_anterior ??
            null;

        // =========================================
        // IMAGEM PRINCIPAL
        // =========================================

        let imagemUrl = '';

        if (
            Array.isArray(normalized.imagens) &&
            normalized.imagens.length > 0
        ) {
            const imagem =
                normalized.imagens[0];

            if (
                typeof imagem === 'string' &&
                imagem.startsWith('http')
            ) {
                imagemUrl = imagem;
            } else if (imagem) {
                imagemUrl =
                    `https://down-br.img.susercontent.com/file/${imagem}`;
            }
        }

        if (
            !imagemUrl &&
            shopeeData.data.item.image
        ) {
            imagemUrl =
                `https://down-br.img.susercontent.com/file/${shopeeData.data.item.image}`;
        }

        const videoUrl =
            normalized.video?.url || null;

        const categoriaNome =
            normalized.categoria ||
            'Achados Imperdíveis';

        console.log('\n========================================');
        console.log('PRODUTO SHOPEE PRONTO PARA SALVAR');
        console.log('========================================');
        console.log('Produto:', normalized.titulo);
        console.log('Preço mínimo:', precoMinimo);
        console.log('Preço máximo:', precoMaximo);
        console.log('Preço anterior:', precoOriginal);
        console.log('Categoria:', categoriaNome);
        console.log('Marketplace:', marketplaceFinal);
        console.log('========================================');

        // =========================================
        // CATEGORIA
        // =========================================

        ensureCategory(
            categoriaNome,
            (categoryError, categoryId) => {

                if (categoryError) {
                    console.error(categoryError);

                    return res.status(500).json({
                        success: false,
                        error:
                            'Erro ao criar/localizar categoria.'
                    });
                }

                // =========================================
                // VERIFICA SE JÁ EXISTE
                // =========================================

                db.get(
                    `
                    SELECT id
                    FROM produtos
                    WHERE url_original = ?
                    `,
                    [urlOriginalFinal],

                    (selectError, existingProduct) => {

                        if (selectError) {
                            console.error(selectError);

                            return res.status(500).json({
                                success: false,
                                error:
                                    'Erro ao verificar produto existente.'
                            });
                        }

                        // =========================================
                        // ATUALIZA SE JÁ EXISTE
                        // =========================================

                        if (existingProduct) {

                            db.run(
                                `
                                UPDATE produtos
                                SET
                                    usuario_id = ?,
                                    categoria_id = ?,
                                    titulo = ?,
                                    preco_original = ?,
                                    preco_oferta = ?,
                                    preco_minimo = ?,
                                    preco_maximo = ?,
                                    imagem_url = ?,
                                    video_url = ?,
                                    link_afiliado = ?,
                                    marketplace = ?
                                WHERE id = ?
                                `,
                                [
                                    usuarioId,
                                    categoryId,
                                    normalized.titulo,
                                    precoOriginal,
                                    precoOferta,
                                    precoMinimo,
                                    precoMaximo,
                                    imagemUrl,
                                    videoUrl,
                                    linkAfiliadoFinal,
                                    marketplaceFinal,
                                    existingProduct.id
                                ],

                                function (updateError) {

                                    if (updateError) {
                                        console.error(updateError);

                                        return res.status(500).json({
                                            success: false,
                                            error:
                                                'Erro ao atualizar produto.'
                                        });
                                    }

                                    console.log(
                                        `✅ PRODUTO ATUALIZADO NO SQLITE - ID ${existingProduct.id}`
                                    );

                                    console.log(
                                        '========================================\n'
                                    );

                                    return res.json({
                                        success: true,
                                        action: 'updated',
                                        id: existingProduct.id,
                                        produto: {
                                            ...normalized,
                                            marketplace:
                                                marketplaceFinal,
                                            link_afiliado:
                                                linkAfiliadoFinal,
                                            url_original:
                                                urlOriginalFinal
                                        }
                                    });
                                }
                            );

                            return;
                        }

                        // =========================================
                        // PRODUTO NOVO
                        // =========================================

                        db.run(
                            `
                            INSERT INTO produtos (
                                usuario_id,
                                categoria_id,
                                titulo,
                                preco_original,
                                preco_oferta,
                                preco_minimo,
                                preco_maximo,
                                imagem_url,
                                video_url,
                                link_afiliado,
                                url_original,
                                marketplace,
                                propaganda_importado
                            )
                            VALUES (
                                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0
                            )
                            `,
                            [
                                usuarioId,
                                categoryId,
                                normalized.titulo,
                                precoOriginal,
                                precoOferta,
                                precoMinimo,
                                precoMaximo,
                                imagemUrl,
                                videoUrl,
                                linkAfiliadoFinal,
                                urlOriginalFinal,
                                marketplaceFinal
                            ],

                            function (insertError) {

                                if (insertError) {
                                    console.error(insertError);

                                    return res.status(500).json({
                                        success: false,
                                        error:
                                            'Erro ao salvar produto no SQLite.'
                                    });
                                }

                                console.log(
                                    `✅ PRODUTO SALVO NO SQLITE - ID ${this.lastID}`
                                );

                                console.log(
                                    '========================================\n'
                                );

                                return res.status(201).json({
                                    success: true,
                                    action: 'created',
                                    id: this.lastID,
                                    produto: {
                                        ...normalized,
                                        marketplace:
                                            marketplaceFinal,
                                        link_afiliado:
                                            linkAfiliadoFinal,
                                        url_original:
                                            urlOriginalFinal
                                    }
                                });
                            }
                        );
                    }
                );
            }
        );

    } catch (error) {

        console.error(
            'Erro ao processar captura da Shopee:',
            error
        );

        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

function normalizeShopeeProductData(payload) {
    if (!payload || !payload.data || !payload.data.item) {
        throw new Error(
            'JSON da Shopee inválido: data.item não encontrado.'
        );
    }

    const item = payload.data.item;

    const money = (value) => {
        if (value === null || value === undefined) {
            return null;
        }

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return null;
        }

        return number / 100000;
    };

    // CATEGORIAS
    const categorias = Array.isArray(item.categories)
        ? item.categories.map((category, index) => ({
            ordem: index,
            id: category.catid,
            nome: category.display_name
        }))
        : [];

    const categoriaPrincipal =
        categorias.length > 0
            ? categorias[categorias.length - 1].nome
            : 'Sem categoria';

    // TIPOS DE VARIAÇÃO
    const tiposVariacao = Array.isArray(item.tier_variations)
        ? item.tier_variations.map((tier, tierIndex) => ({
            indice: tierIndex,
            nome: tier.name,
            opcoes: Array.isArray(tier.options)
                ? tier.options.map((option, optionIndex) => ({
                    indice: optionIndex,
                    nome: option,
                    imagem:
                        Array.isArray(tier.images)
                            ? tier.images[optionIndex] || null
                            : null
                }))
                : []
        }))
        : [];

    // VARIAÇÕES / SKUS
    const variacoes = Array.isArray(item.models)
        ? item.models.map((model) => {
            const tierIndexes =
                Array.isArray(model.extinfo?.tier_index)
                    ? model.extinfo.tier_index
                    : [];

            const atributos = {};

            tierIndexes.forEach((optionIndex, tierIndex) => {
                const tier = tiposVariacao[tierIndex];

                if (!tier) return;

                const option = tier.opcoes[optionIndex];

                atributos[tier.nome] =
                    option ? option.nome : null;
            });

            const precoAtual = money(model.price);

            const precoAnterior =
                model.price_before_discount
                    ? money(model.price_before_discount)
                    : null;

            return {
                model_id: model.model_id,

                nome: model.name || '',

                atributos,

                preco: precoAtual,

                preco_anterior: precoAnterior,

                promocao:
                    precoAnterior !== null &&
                    precoAtual !== null &&
                    precoAnterior > precoAtual,

                promotion_id:
                    model.promotion_id || null,

                possui_estoque:
                    model.has_stock === true,

                disponivel:
                    model.is_clickable === true &&
                    model.is_grayout !== true,

                pre_venda:
                    model.extinfo?.is_pre_order === true,

                prazo_estimado_dias:
                    model.extinfo?.estimated_days ?? null,

                imagem:
                    model.extinfo?.sku_image || null,

                tier_index:
                    tierIndexes
            };
        })
        : [];

    // ATRIBUTOS
    const atributos = Array.isArray(item.attributes)
        ? item.attributes.map(attribute => ({
            id: attribute.id,
            nome: attribute.name,
            valor: attribute.value
        }))
        : [];

    // IMAGENS
    const imagens =
        Array.isArray(payload.data.product_images?.images)
            ? payload.data.product_images.images
            : [];

    // VÍDEO
    const videoData =
        payload.data.product_images?.video || null;

    const video = videoData
        ? {
            id: videoData.video_id || null,

            url:
                videoData.default_format?.url ||
                videoData.formats?.[0]?.url ||
                null,

            thumbnail:
                videoData.thumb_url || null,

            duracao:
                videoData.duration || null
        }
        : null;

    // TABELA DE MEDIDAS
    const tabelaMedidas =
        Array.isArray(item.size_chart_info?.table?.columns)
            ? item.size_chart_info.table.columns.map(column => ({
                nome:
                    column.header?.display_name ||
                    column.header?.name ||
                    '',

                unidade:
                    column.header?.unit || '',

                valores:
                    column.cell_values || []
            }))
            : [];

    // PREÇOS
    const precos = {
        atual:
            money(item.price),

        minimo:
            money(item.price_min),

        maximo:
            money(item.price_max),

        anterior:
            item.price_before_discount
                ? money(item.price_before_discount)
                : null,

        minimo_anterior:
            item.price_min_before_discount
                ? money(item.price_min_before_discount)
                : null,

        maximo_anterior:
            item.price_max_before_discount
                ? money(item.price_max_before_discount)
                : null,

        desconto_percentual:
            item.raw_discount ??
            item.show_discount ??
            null
    };

    // FRETE
    const frete = {
        gratis:
            item.is_free_shipping === true,

        prazo_estimado_dias:
            item.estimated_days ?? null,

        local_vendedor:
            item.shop_location || null
    };

    return {
        origem: 'shopee',

        item_id:
            item.item_id,

        shop_id:
            item.shop_id,

        titulo:
            item.title || '',

        descricao:
            item.description || '',

        marca:
            item.brand || null,

        moeda:
            item.currency || 'BRL',

        categoria:
            categoriaPrincipal,

        categorias,

        precos,

        tipos_variacao:
            tiposVariacao,

        variacoes,

        atributos,

        imagens,

        video,

        tabela_medidas:
            tabelaMedidas,

        frete,

        avaliacao:
            item.item_rating?.rating_star ?? null,

        status:
            item.item_status || null
    };
}

function normalizeShopeeUrl(value) {
    try {
        let input = String(value || '').trim();
        if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(input)) {
            input = `https://${input}`;
        }
        const url = new URL(input);
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch (error) {
        return String(value || '').trim();
    }
}
function extractShopeeIds(productUrl) {
    const value = String(productUrl || '');

    /*
     * URLs da Shopee normalmente terminam assim:
     *
     * ...-i.SHOP_ID.ITEM_ID
     *
     * Exemplo:
     * ...-i.604045467.23393138832
     */

    const match = value.match(/-i\.(\d+)\.(\d+)/i);

    if (!match) {
        throw new Error(
            'Não foi possível identificar shop_id e item_id na URL da Shopee.'
        );
    }

    return {
        shopId: match[1],
        itemId: match[2]
    };
}


async function fetchShopeeProductApi(productUrl) {
    const { shopId, itemId } = extractShopeeIds(productUrl);

    const apiUrls = [
        `https://shopee.com.br/api/v4/pdp/get_pc?item_id=${itemId}&shop_id=${shopId}&tz_offset_minutes=-180&detail_level=0`,
        `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`
    ];

    console.log('\n========================================');
    console.log('SHOPEE PRODUCT API');
    console.log('========================================');
    console.log('SHOP ID:', shopId);
    console.log('ITEM ID:', itemId);

    let lastError = null;

    for (const apiUrl of apiUrls) {
        try {
            console.log('\nTentando API:');
            console.log(apiUrl);

            const result = await new Promise((resolve, reject) => {
                const request = https.get(
                    apiUrl,
                    {
                        headers: {
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                                'Chrome/131.0.0.0 Safari/537.36',

                            'Accept': 'application/json,text/plain,*/*',

                            'Accept-Language':
                                'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',

                            'Referer': productUrl
                        }
                    },
                    response => {
                        let body = '';

                        response.on('data', chunk => {
                            body += chunk;
                        });

                        response.on('end', () => {
                            resolve({
                                statusCode: response.statusCode,
                                body
                            });
                        });
                    }
                );

                request.setTimeout(30000, () => {
                    request.destroy(
                        new Error('Timeout ao consultar API da Shopee.')
                    );
                });

                request.on('error', reject);
            });

            console.log(
                'STATUS API:',
                result.statusCode
            );

            if (result.statusCode !== 200) {
                lastError = new Error(
                    `API retornou HTTP ${result.statusCode}`
                );

                continue;
            }

            let json;

            try {
                json = JSON.parse(result.body);
            } catch (error) {
                lastError = new Error(
                    'Resposta da Shopee não contém JSON válido.'
                );

                continue;
            }

            if (!json) {
                continue;
            }

            console.log('\n========================================');
            console.log('JSON RECEBIDO DA SHOPEE');
            console.log('========================================');

            console.dir(json, {
                depth: 8,
                colors: true,
                maxArrayLength: 50
            });

            console.log(
                '========================================\n'
            );

            return {
                shopId,
                itemId,
                sourceUrl: apiUrl,
                raw: json
            };

        } catch (error) {
            lastError = error;

            console.error(
                'Falha nesta API:',
                error.message
            );
        }
    }

    throw lastError ||
        new Error(
            'Nenhuma API da Shopee retornou os dados do produto.'
        );
}

function parsePriceCandidates(html) {
    const candidates = [];
    const regexes = [
        /R\$\s*([0-9]{1,3}(?:[\.\,][0-9]{3})*(?:[\.,][0-9]{2}))/g,
        /"(?:price|current_price|sale_price|min_price|max_price)"\s*:\s*"?([0-9]+(?:\.[0-9]+)?(?:,[0-9]{2})?)"?/gi
    ];
    for (const regex of regexes) {
        let match;
        while ((match = regex.exec(html)) !== null) {
            const cleaned = cleanPrice(match[1]);
            if (cleaned && cleaned !== '0') candidates.push(parseFloat(cleaned));
        }
    }
    if (candidates.length === 0) return '';
    const unique = Array.from(new Set(candidates));
    console.log('PREÇOS ENCONTRADOS NA SHOPEE:', unique);
    return unique.sort((a, b) => a - b)[0].toString();
}

// FUNÇÃO CORRIGIDA: Ajuste nas variáveis e retorno de propriedades coerentes
function extractShopeeProduct(html, pageUrl, affiliateLink) {
    const title =
        getMetaContent(html, 'og:title') ||
        getMetaContent(html, 'twitter:title') ||
        'Produto Shopee';

    let description =
        getMetaContent(html, 'og:description') ||
        getMetaContent(html, 'description') ||
        '';

    let imageUrl =
        getMetaContent(html, 'og:image') ||
        getMetaContent(html, 'twitter:image') ||
        '';

    let categoryName =
        getMetaContent(html, 'product:category') ||
        getMetaContent(html, 'og:category') ||
        getMetaContent(html, 'category') ||
        '';

    const jsonLd = parseJsonLd(html);

    let preco = '';
    let data = null;

    console.log('\n========================================');
    console.log('DIAGNÓSTICO DE IMPORTAÇÃO SHOPEE');
    console.log('Produto:', title);
    console.log('========================================');

    // ============================================================
    // 1. JSON-LD
    // ============================================================

    if (jsonLd) {
        data = Array.isArray(jsonLd)
            ? jsonLd.find((item) => item && item['@type'] === 'Product') || jsonLd[0]
            : jsonLd;

        if (data) {
            const offers = Array.isArray(data.offers)
                ? data.offers[0]
                : data.offers;

            if (offers) {
                console.log('OFFERS DA SHOPEE:');
                console.dir(offers, { depth: 5 });

                console.log('offers.price:', offers.price);
                console.log('offers.lowPrice:', offers.lowPrice);
                console.log('offers.highPrice:', offers.highPrice);

                if (offers.priceSpecification) {
                    console.log(
                        'offers.priceSpecification:',
                        offers.priceSpecification
                    );
                }

                preco = cleanPrice(
                    offers.price ||
                    offers.lowPrice ||
                    offers.priceSpecification?.price ||
                    ''
                );

                console.log('PREÇO VINDO DO JSON-LD:', preco || 'NÃO ENCONTRADO');
            }

            if (!description && data.description) {
                description = data.description;
            }

            if (!imageUrl && data.image) {
                imageUrl = Array.isArray(data.image)
                    ? data.image[0]
                    : data.image;
            }

            if (!categoryName && data.category) {
                categoryName = Array.isArray(data.category)
                    ? data.category[0]
                    : data.category;
            }
        }
    }

    // ============================================================
    // 2. CATEGORIA
    // ============================================================

    if (!categoryName) {
        const breadcrumbMatch = html.match(
            /<a[^>]*href=["'][^"']+["'][^>]*>([^<]+)<\/a>\s*>\s*<span[^>]*>/i
        );

        if (breadcrumbMatch) {
            categoryName = breadcrumbMatch[1].trim();
        }
    }

    // ============================================================
    // 3. METATAGS DE PREÇO
    // ============================================================

    if (!preco) {
        const metaPrice =
            getMetaContent(html, 'product:price:amount') ||
            getMetaContent(html, 'price');

        console.log(
            'PREÇO ENCONTRADO NAS METATAGS:',
            metaPrice || 'NÃO ENCONTRADO'
        );

        preco = cleanPrice(metaPrice);
    }

    // ============================================================
    // 4. CANDIDATOS ENCONTRADOS NO HTML
    // ============================================================

    if (!preco || preco === '0') {
        const candidate = parsePriceCandidates(html);

        console.log(
            'PREÇO RETORNADO POR parsePriceCandidates:',
            candidate || 'NÃO ENCONTRADO'
        );

        if (candidate) {
            preco = candidate;
        }
    }

    // ============================================================
    // 5. FAIXA VISÍVEL DE PREÇO
    // Exemplo:
    // R$ 29,99 - R$ 47,99
    // ============================================================

    if (!preco || preco === '0') {
        const rangeMatch = html.match(
            /R\$\s*([0-9\.,]+)\s*-\s*R\$\s*([0-9\.,]+)/i
        );

        if (rangeMatch) {
            console.log(
                'FAIXA DE PREÇO ENCONTRADA:',
                rangeMatch[1],
                '-',
                rangeMatch[2]
            );

            preco = cleanPrice(rangeMatch[1]);
        }
    }

    // ============================================================
    // VÍDEO
    // ============================================================

    let videoUrl =
        getMetaContent(html, 'og:video') ||
        getMetaContent(html, 'twitter:player') ||
        '';

    if (!imageUrl) {
        const imageMatch = html.match(
            /https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i
        );

        imageUrl = imageMatch
            ? imageMatch[0]
            : imageUrl;
    }

    if (!videoUrl && data && data.video) {
        videoUrl = Array.isArray(data.video)
            ? data.video[0]?.contentUrl || data.video[0]
            : data.video;
    }

    console.log('----------------------------------------');
    console.log('PREÇO FINAL EXTRAÍDO:', preco || '0');
    console.log(
        'CATEGORIA EXTRAÍDA:',
        categoryName || 'Achados Imperdíveis'
    );
    console.log('========================================\n');

    return {
        titulo: title,
        descricao: description,
        imagem_url: imageUrl || '',
        video_url: videoUrl || '',
        preco: preco || '0',
        categoria_nome: categoryName || 'Achados Imperdíveis',
        link_afiliado: affiliateLink || pageUrl
    };
}

// Carrega a página com Puppeteer e tenta extrair preço renderizado por JS
async function fetchPriceWithPuppeteer(pageUrl) {
    const browser = await puppeteer.launch({
        executablePath: CHROME_EXECUTABLE_PATH,

        headless: false,

        defaultViewport: null,

        userDataDir: path.join(__dirname, 'chrome-shopee-profile-test'),

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--start-maximized',
            '--lang=pt-BR'
        ]
    });

    try {

        const page = await browser.newPage();
        page.on('console', msg => {
    console.log('BROWSER CONSOLE:', msg.type(), msg.text());
});

page.on('pageerror', error => {
    console.log('BROWSER PAGE ERROR:', error.message);
});

page.on('requestfailed', request => {
    console.log(
        'REQUEST FAILED:',
        request.url(),
        request.failure()?.errorText
    );
});

        await page.setViewport({
            width: 1366,
            height: 900
        });

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/131.0.0.0 Safari/537.36'
        );

        console.log('\n========================================');
        console.log('SCANNER SHOPEE - ABRINDO PRODUTO');
        console.log(pageUrl);
        console.log('========================================');

        const response = await page.goto(pageUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
});

console.log('\n========================================');
console.log('ESTADO VISUAL DA PÁGINA');
console.log('URL FINAL:', page.url());
console.log('TÍTULO:', await page.title());
console.log(
    'BODY:',
    await page.evaluate(() =>
        document.body?.innerText?.substring(0, 1000) || ''
    )
);
console.log('========================================\n');

await new Promise(resolve => setTimeout(resolve, 15000));


console.log('\n========================================');
console.log('DIAGNÓSTICO DE NAVEGAÇÃO');
console.log('========================================');

console.log(
    'STATUS HTTP:',
    response ? response.status() : 'SEM RESPONSE'
);

console.log(
    'URL SOLICITADA:',
    pageUrl
);

console.log(
    'URL FINAL:',
    page.url()
);

console.log(
    'TÍTULO FINAL:',
    await page.title()
);

const diagnosticHtml = await page.content();

console.log(
    'TAMANHO DO HTML:',
    diagnosticHtml.length
);

console.log('========================================\n');

        await new Promise(resolve => setTimeout(resolve, 3000));

        const productData = await page.evaluate(() => {
            function parseMoney(text) {
                if (!text) return null;

                const match = text.match(/R\$\s*([\d.]+,\d{2})/i);

                if (!match) return null;

                return Number(
                    match[1]
                        .replace(/\./g, '')
                        .replace(',', '.')
                );
            }

            function visible(element) {
                if (!element) return false;

                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();

                return (
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    rect.width > 0 &&
                    rect.height > 0
                );
            }

            const result = {
                titulo: '',
                descricao: '',
                categoria: '',
                imagens: [],
                precos_visiveis: [],
                variacoes: [],
                fretes_visiveis: [],
                textos_comerciais: []
            };

            // TÍTULO
            const h1 = document.querySelector('h1');

            if (h1) {
                result.titulo = h1.innerText.trim();
            }

            // IMAGENS
            const images = Array.from(
                document.querySelectorAll('img')
            );

            result.imagens = Array.from(
                new Set(
                    images
                        .map(img => img.src)
                        .filter(src =>
                            src &&
                            src.startsWith('http')
                        )
                )
            ).slice(0, 30);

            // TODOS OS ELEMENTOS VISÍVEIS
            const elements = Array.from(
                document.querySelectorAll('body *')
            );

            for (const element of elements) {
                if (!visible(element)) {
                    continue;
                }

                const text = (element.innerText || '').trim();

                if (!text) {
                    continue;
                }

                // PREÇOS VISÍVEIS
                if (
                    text.includes('R$') &&
                    text.length <= 100
                ) {
                    const values = Array.from(
                        text.matchAll(
                            /R\$\s*([\d.]+,\d{2})/gi
                        )
                    );

                    if (values.length > 0) {
                        result.precos_visiveis.push({
                            texto: text,
                            valores: values.map(item =>
                                Number(
                                    item[1]
                                        .replace(/\./g, '')
                                        .replace(',', '.')
                                )
                            )
                        });
                    }
                }

                // FRETE
                const lower = text.toLowerCase();

                if (
                    (
                        lower.includes('frete') ||
                        lower.includes('envio')
                    ) &&
                    text.length <= 150
                ) {
                    result.fretes_visiveis.push(text);
                }

                // POSSÍVEIS VARIAÇÕES
                if (
                    text.length <= 60 &&
                    (
                        lower.includes('tamanho') ||
                        lower.includes('cor')
                    )
                ) {
                    result.variacoes.push(text);
                }

                // TERMOS COMERCIAIS
                if (
                    text.length <= 150 &&
                    (
                        lower.includes('cupom') ||
                        lower.includes('promoção') ||
                        lower.includes('promocao') ||
                        lower.includes('desconto') ||
                        lower.includes('parcelamento') ||
                        lower.includes('cartão') ||
                        lower.includes('cartao')
                    )
                ) {
                    result.textos_comerciais.push(text);
                }
            }

            // REMOVE DUPLICADOS
            result.fretes_visiveis =
                Array.from(new Set(result.fretes_visiveis));

            result.variacoes =
                Array.from(new Set(result.variacoes));

            result.textos_comerciais =
                Array.from(new Set(result.textos_comerciais));

            // META DESCRIPTION
            const description =
                document.querySelector(
                    'meta[name="description"]'
                );

            if (description) {
                result.descricao =
                    description.getAttribute('content') || '';
            }

            // BREADCRUMB / CATEGORIA
            const links = Array.from(
                document.querySelectorAll('a')
            );

            const breadcrumb = links
                .map(link => link.innerText.trim())
                .filter(text => text.length > 0)
                .slice(0, 20);

            result.categoria = breadcrumb;

            return result;
        });

        console.log('\n========================================');
        console.log('RESULTADO DO SCANNER SHOPEE');
        console.log('========================================');

        console.dir(productData, {
            depth: null,
            colors: true
        });

        console.log('========================================\n');

        const html = await page.content();

        const firstPrice =
            productData.precos_visiveis?.[0]?.valores?.[0];

        return {
            html,
            priceText:
                firstPrice !== undefined
                    ? String(firstPrice)
                    : null,
            productData
        };

    } finally {
        await browser.close();
    }
}
// ============================================================
// CAPTURA AUTOMÁTICA DO JSON REAL DA SHOPEE VIA CHROME
// ============================================================

async function captureShopeeProductWithBrowser(productUrl) {
    const { shopId, itemId } = extractShopeeIds(productUrl);

    console.log('\n========================================');
    console.log('CAPTURA AUTOMÁTICA SHOPEE');
    console.log('SHOP ID:', shopId);
    console.log('ITEM ID:', itemId);
    console.log('URL:', productUrl);
    console.log('========================================');

    const browser = await puppeteer.launch({
        executablePath: CHROME_EXECUTABLE_PATH,

        headless: false,

        defaultViewport: null,

        userDataDir: path.join(
    __dirname,
    'chrome-shopee-profile-test'
),

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--start-maximized',
            '--lang=pt-BR'
        ]
    });

    let page;

    try {
        page = await browser.newPage();

        await page.setViewport({
            width: 1366,
            height: 900
        });

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/131.0.0.0 Safari/537.36'
        );

        let capturedJson = null;
        let capturedUrl = null;

        const capturePromise = new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve(null);
            }, 30000);

            page.on('response', async (response) => {
                try {
                    const responseUrl = response.url();

                    if (responseUrl.includes('/api/v4/pdp/get_pc')) {
    console.log('\nGET_PC INTERCEPTADO:');
    console.log(responseUrl);
    console.log(
    'HORÁRIO:',
    new Date().toISOString()
);
}

                    if (
                        !responseUrl.includes(
                            '/api/v4/pdp/get_pc'
                        )
                    ) {
                        return;
                    }

                    console.log('\n----------------------------------------');
                console.log('GET_PC - RESPOSTA INTERCEPTADA');
                console.log('STATUS:', response.status());
                console.log(
            'CONTENT-TYPE:',
            response.headers()['content-type']
);
console.log('URL:', responseUrl);
console.log('----------------------------------------');

                    const parsedUrl =
                        new URL(responseUrl);

                    const responseItemId =
                        parsedUrl.searchParams.get(
                            'item_id'
                        );

                    const responseShopId =
                        parsedUrl.searchParams.get(
                            'shop_id'
                        );

                    if (
                        String(responseItemId) !==
                            String(itemId) ||
                        String(responseShopId) !==
                            String(shopId)
                    ) {
                        return;
                    }

                    if (response.status() !== 200) {
                        console.log(
                            'get_pc encontrado, mas HTTP:',
                            response.status()
                        );

                        return;
                    }

let json;

try {
    json = await response.json();
} catch (jsonError) {
    console.log('\n========================================');
    console.log('GET_PC NÃO PÔDE SER CONVERTIDO EM JSON');
    console.log('========================================');
    console.log('ERRO:', jsonError.message);

    try {
        const body = await response.text();

        console.log(
            'CORPO RECEBIDO:',
            body.substring(0, 2000)
        );
    } catch (bodyError) {
        console.log(
            'Também não foi possível ler o corpo:',
            bodyError.message
        );
    }

    console.log('========================================\n');

    return;
}
                if (
                   !json ||
                   !json.data ||
                   !json.data.item
) {
    console.log('\n========================================');
    console.log('GET_PC RECEBIDO, MAS ESTRUTURA DIFERENTE');
    console.log('========================================');

    console.log(
        'CHAVES PRINCIPAIS:',
        json ? Object.keys(json) : []
    );

    console.log(
        'CHAVES DE DATA:',
        json?.data ? Object.keys(json.data) : []
    );

    console.log(
        'ERROR:',
        json?.error
    );

    console.log(
        'ERROR_MSG:',
        json?.error_msg
    );

    console.log(
        'MESSAGE:',
        json?.message
    );

    console.log('JSON RESUMIDO:');

    console.dir(json, {
        depth: 3,
        colors: true,
        maxArrayLength: 10
    });

    console.log('========================================\n');

    return;
}

                    capturedJson = json;
                    capturedUrl = responseUrl;

                    clearTimeout(timeout);

                    resolve({
                        raw: capturedJson,
                        sourceUrl: capturedUrl
                    });

                } catch (error) {
                    console.error(
                        'Erro ao analisar resposta get_pc:',
                        error.message
                    );
                }
            });
        });

        console.log(
            'Abrindo produto no Chrome...'
        );

        await page.goto(productUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        console.log('\n========================================');
console.log('ESTADO VISUAL DA PÁGINA');
console.log('URL FINAL:', page.url());
console.log('TÍTULO:', await page.title());
console.log(
    'BODY:',
    await page.evaluate(() =>
        document.body?.innerText?.substring(0, 1000) || ''
    )
);
console.log('========================================\n');

await new Promise(resolve => setTimeout(resolve, 15000));

        const captured =
            await capturePromise;

        if (!captured?.raw) {
            throw new Error(
                'A Shopee não retornou o JSON get_pc válido para este produto.'
            );
        }

        console.log('\n========================================');
        console.log('GET_PC CAPTURADO COM SUCESSO');
        console.log('========================================');
        console.log('SHOP ID:', shopId);
        console.log('ITEM ID:', itemId);
        console.log('HTTP/API:', captured.sourceUrl);
        console.log('========================================\n');

        return {
            shopId,
            itemId,
            sourceUrl: captured.sourceUrl,
            raw: captured.raw
        };

    } finally {
        console.log('TESTE: navegador mantido aberto para verificar sessão/login da Shopee.');
    // await browser.close();
    }
}

app.get('/teste-captura-shopee', async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({
                error: 'Informe ?url=URL_DO_PRODUTO'
            });
        }

        const result = await captureShopeeProductWithBrowser(url);

        res.json({
            ok: true,
            shopId: result.shopId,
            itemId: result.itemId,
            sourceUrl: result.sourceUrl,
            hasItem: !!result.raw?.data?.item
        });

    } catch (error) {
        console.error('Erro no teste de captura:', error);

        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

// Configuração inicial do banco de dados
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        slug_loja TEXT UNIQUE NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        categoria_id INTEGER,
        titulo TEXT NOT NULL,
        preco_original REAL,
        preco_oferta REAL NOT NULL,
        imagem_url TEXT NOT NULL,
        video_url TEXT,
        link_afiliado TEXT NOT NULL,
        url_original TEXT,
        propaganda_importado INTEGER DEFAULT 0,
        cliques INTEGER DEFAULT 0,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    )`);
    db.all("PRAGMA table_info(produtos)", (err, columns) => {
        if (!err && columns) {
            const names = columns.map((col) => col.name);
            db.serialize(() => {
                if (!names.includes('video_url')) {
                    db.run('ALTER TABLE produtos ADD COLUMN video_url TEXT');
                }
                if (!names.includes('url_original')) {
                    db.run('ALTER TABLE produtos ADD COLUMN url_original TEXT');
                }
                if (!names.includes('propaganda_importado')) {
                    db.run('ALTER TABLE produtos ADD COLUMN propaganda_importado INTEGER DEFAULT 0');
                }
                if (!names.includes('propaganda_importado')) {
    db.run('ALTER TABLE produtos ADD COLUMN propaganda_importado INTEGER DEFAULT 0');
}

if (!names.includes('marketplace')) {
    db.run(`
        ALTER TABLE produtos
        ADD COLUMN marketplace TEXT DEFAULT 'shopee'
    `);
}

if (!names.includes('preco_minimo')) {
    db.run(`
        ALTER TABLE produtos
        ADD COLUMN preco_minimo REAL
    `);
}

if (!names.includes('preco_maximo')) {
    db.run(`
        ALTER TABLE produtos
        ADD COLUMN preco_maximo REAL
    `);
}

db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_url_original ON produtos(url_original)');

    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_url_original ON produtos(url_original)');
            });
        }
    });

    // Inserção de categorias padrão se vazia
    db.get('SELECT COUNT(*) AS count FROM categorias', (err, row) => {
        if (!err && row && row.count === 0) {
            const categoriasPadrao = [
                ['Casa & Cozinha', 'casa-cozinha'],
                ['Beleza & Maquiagem', 'beleza-maquiagem'],
                ['Eletrônicos & Acessórios', 'eletronicos'],
                ['Achados Imperdíveis', 'achados']
            ];
            const stmt = db.prepare('INSERT INTO categorias (nome, slug) VALUES (?, ?)');
            categoriasPadrao.forEach((cat) => stmt.run(cat));
            stmt.finalize();
            console.log('Categorias iniciais padrão criadas.');
        }
    });

    // Usuário de teste inicial
    db.get('SELECT COUNT(*) AS count FROM usuarios', (err, row) => {
        if (!err && row && row.count === 0) {
            db.run(`INSERT INTO usuarios (nome, email, slug_loja) VALUES ('Ana Afiliada', 'ana@email.com', 'achadosdaana')`);
            console.log('Usuário de teste criado: /l/achadosdaana');
        }
    });
});

app.get('/', (req, res) => {
    res.redirect('/l/achadosdaana');
});

// ROTA CORRIGIDA: Agora renderiza corretamente a lojinha com filtros e busca ativa
app.get('/l/:slug', (req, res) => {
    const { slug } = req.params;
    const search = req.query.q ? String(req.query.q).trim() : '';
    const category = req.query.category ? String(req.query.category).trim() : '';

    db.get('SELECT * FROM usuarios WHERE slug_loja = ?', [slug], (err, usuario) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Erro interno.');
        }
        if (!usuario) return res.status(404).send('Lojinha não encontrada.');

        db.all('SELECT * FROM categorias', [], (err, categorias) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Erro ao buscar categorias.');
            }

            let queryProdutos = `
                SELECT p.*, c.nome as categoria_nome 
                FROM produtos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                WHERE p.usuario_id = ?
            `;
            const params = [usuario.id];

            if (search) {
                queryProdutos += " AND p.titulo LIKE ?";
                params.push(`%${search}%`);
            }
            if (category) {
                queryProdutos += " AND c.slug = ?";
                params.push(category);
            }

            db.all(queryProdutos, params, (err, produtos) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Erro ao buscar produtos.");
                }
                res.render('lojinha', { usuario, categorias, produtos, search, categorySelected: category });
            });
        });
    });
});

// ROTA CORRIGIDA: Agora redireciona corretamente o cliente para a Shopee após registrar o clique
app.get('/click/:id', (req, res) => {
    const produtoId = req.params.id;
    db.run('UPDATE produtos SET cliques = cliques + 1 WHERE id = ?', [produtoId], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Erro ao registrar clique.');
        }
        db.get("SELECT link_afiliado FROM produtos WHERE id = ?", [produtoId], (err, produto) => {
            if (err || !produto) return res.status(404).send("Produto não encontrado.");
            res.redirect(produto.link_afiliado);
        });
    });
});

// ============================================================
// RECEBE O JSON REAL CAPTURADO NO NAVEGADOR
// ============================================================

// ============================================================
// CAPTURA REAL DO PRODUTO SHOPEE
// ============================================================


app.get('/admin', (req, res) => {
    res.render('admin', { usuarioId: 1 });
});

// ROTA DE IMPORTAÇÃO COMPLETA: Agora ela salva o produto extraído direto no banco SQLite!
app.post('/api/produtos/import', async (req, res) => {
    const { usuario_id, shopee_url, link_afiliado } = req.body;
    const errors = [];

    if (!usuario_id) errors.push('usuario_id é obrigatório.');
    if (!shopee_url || !shopee_url.trim()) errors.push('shopee_url é obrigatório.');
    if (errors.length) return res.status(400).json({ errors });

    const normalizedUrl = normalizeShopeeUrl(shopee_url);
    const affiliateLink = link_afiliado && link_afiliado.trim() ? link_afiliado.trim() : normalizedUrl;

    db.get('SELECT id FROM produtos WHERE url_original = ?', [normalizedUrl], async (err, existing) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao verificar produto existente.' });
        }
        if (existing) {
            return res.status(409).json({ error: 'Produto já importado anteriormente.' });
        }

    try {
            
    const html = await fetchHtml(normalizedUrl);

    let product = extractShopeeProduct(
        html,
        normalizedUrl,
        affiliateLink
    );

    // Se não encontramos preço no HTML estático, tente com Puppeteer
    // CAPTURA OFICIAL DA SHOPEE COM PUPPETEER
    // Agora SEMPRE consultamos a página renderizada.
    
try {

    const {
        html: renderedHtml,
        priceText
    } = await fetchPriceWithPuppeteer(normalizedUrl);

    if (priceText) {

        const cleaned = cleanPrice(priceText);

        if (cleaned) {

            console.log('PREÇO OFICIAL DA SHOPEE:', cleaned);

            // O preço renderizado substitui qualquer valor encontrado antes.
            product.preco = cleaned;
        }
    }

    const updated = extractShopeeProduct(
        renderedHtml,
        normalizedUrl,
        product.link_afiliado
    );

    product.imagem_url =
        product.imagem_url ||
        updated.imagem_url;

    product.descricao =
        product.descricao ||
        updated.descricao;

    product.categoria_nome =
        updated.categoria_nome ||
        product.categoria_nome;

} catch (puErr) {

    console.error(
        'Erro ao capturar produto com Puppeteer:',
        puErr.message || puErr
    );
}

const precoValido = parseFloat(product.preco);

if (!precoValido || precoValido <= 0) {
    return res.status(422).json({
        error: 'Produto sem preço confiável. Importação cancelada.'
    });
}
            ensureCategory(product.categoria_nome, (err, categoryId) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Erro ao garantir categoria do produto.' });
                }
                db.run(
                    `INSERT INTO produtos (usuario_id, categoria_id, titulo, preco_original, preco_oferta, imagem_url, video_url, link_afiliado, url_original, propaganda_importado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                    [usuario_id, categoryId, product.titulo, null, precoValido, product.imagem_url, product.video_url || null, product.link_afiliado, normalizedUrl],
                    function (err) {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({ error: 'Erro ao salvar produto importado.' });
                        }
                        res.status(201).json({ id: this.lastID, ...product });
                    }
                );
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message || 'Falha ao importar o produto.' });
        }
    });
});

app.post('/api/produtos/import-propaganda', async (req, res) => {
    const { usuario_id, shopee_url, link_afiliado } = req.body;
    const errors = [];

    if (!usuario_id) errors.push('usuario_id é obrigatório.');
    if (!shopee_url || !shopee_url.trim()) errors.push('shopee_url é obrigatório.');
    if (errors.length) return res.status(400).json({ errors });

    try {
        const html = await fetchHtml(shopee_url.trim());
        let product = extractShopeeProduct(html, shopee_url.trim(), link_afiliado && link_afiliado.trim() ? link_afiliado.trim() : shopee_url.trim());

        // Se não encontramos preço no HTML estático, tente com Puppeteer
        if ((!product.preco || product.preco === '0')) {
            try {
                const { html: renderedHtml, priceText } = await fetchPriceWithPuppeteer(shopee_url.trim());
                if (priceText) {
                    const cleaned = cleanPrice(priceText);
                    if (cleaned) product.preco = cleaned;
                }
                const updated = extractShopeeProduct(renderedHtml, shopee_url.trim(), product.link_afiliado);
                product.imagem_url = product.imagem_url || updated.imagem_url;
                product.descricao = product.descricao || updated.descricao;
                product.categoria_nome = product.categoria_nome || updated.categoria_nome;
            } catch (puErr) {
                console.error('Puppeteer error:', puErr.message || puErr);
            }
        }
const precoValido = parseFloat(product.preco);

if (!precoValido || precoValido <= 0) {
    return res.status(422).json({
        error: 'Produto sem preço confiável. Importação cancelada.'
    });
}

        ensureCategory(product.categoria_nome, (err, categoryId) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Erro ao garantir categoria do produto.' });
            }
            db.run(
                `INSERT INTO produtos (usuario_id, categoria_id, titulo, preco_original, preco_oferta, imagem_url, video_url, link_afiliado, propaganda_importado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [usuario_id, categoryId, product.titulo, null, precoValido, product.imagem_url, product.video_url || null, product.link_afiliado],
                function (err) {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ error: 'Erro ao salvar produto de propaganda.' });
                    }
                    res.status(201).json({ id: this.lastID, propaganda: true, ...product });
                }
            );
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Falha ao importar o produto para propaganda.' });
    }
});

const server = app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Falha ao iniciar: porta ${PORT} já está em uso.`);
        console.error('Defina a variável de ambiente PORT ou encerre o processo usando a porta atual.');
    } else {
        console.error('Erro no servidor:', err);
    }
    process.exit(1);
});

module.exports = { app, db, server, fetchHtml, extractShopeeProduct, fetchPriceWithPuppeteer, cleanPrice, parsePriceCandidates };

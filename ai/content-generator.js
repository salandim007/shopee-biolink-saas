'use strict';

const {
    generateAI
} = require('./ai-service');


const CHANNEL_RULES = {
    instagram: {
        name: 'Instagram',
        style:
            'visual, direto, natural e fácil de ler no celular',
        formats: [
            'feed',
            'story',
            'reel',
            'carousel'
        ]
    },

    facebook: {
        name: 'Facebook',
        style:
            'conversacional, explicativo e orientado ao interesse',
        formats: [
            'feed',
            'reel',
            'carousel'
        ]
    },

    pinterest: {
        name: 'Pinterest',
        style:
            'objetivo, pesquisável, inspiracional e descritivo',
        formats: [
            'pin',
            'video',
            'carousel'
        ]
    }
};


function parseJson(content) {
    return JSON.parse(
        String(content || '')
            .replace(/^```json\s*/i, '')
            .replace(/\s*```$/, '')
            .trim()
    );
}


function normalizeContent(
    value,
    channel
) {
    return {
        channel,

        headline:
            value.titulo || null,

        hook:
            value.gancho || null,

        body:
            value.texto || null,

        cta:
            value.cta || null,

        overlayText:
            value.textoNaMidia || null,

        hashtags:
            Array.isArray(value.hashtags)
                ? value.hashtags
                : [],

        mediaInstruction:
            value.instrucaoMidia || null,

        altText:
            value.textoAlternativo || null,

        warnings:
            Array.isArray(value.alertas)
                ? value.alertas
                : []
    };
}


function validateChannel(channel) {
    if (!CHANNEL_RULES[channel]) {
        throw new Error(
            `Canal não suportado: ${channel}`
        );
    }

    return CHANNEL_RULES[channel];
}


function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}


function sourceTextForValidation(productFacts) {
    return normalizeText([
        productFacts.title,
        productFacts.description
    ].filter(Boolean).join(' '));
}


function extractNumbers(value) {
    return (
        normalizeText(value)
            .match(/\d+(?:[.,]\d+)?/g) || []
    );
}


function hasUnsupportedNumber(
    sentence,
    sourceText
) {
    const numbers =
        extractNumbers(sentence);

    if (!numbers.length) {
        return false;
    }

    return numbers.some(
        number =>
            !sourceText.includes(
                normalizeText(number)
            )
    );
}


function hasUnsafeAbsoluteClaim(value) {
    const text =
        normalizeText(value);

    const patterns = [
        /\b100\s*%/,
        /\bgarante\b/,
        /\bgarantido\b/,
        /\bgarantida\b/,
        /\bgarantia total\b/,
        /\bseguranca total\b/,
        /\bdefinitiv[oa]\b/,
        /\bresultado imediato\b/,
        /\bresultado garantido\b/,
        /\bsem risco\b/,
        /\bzero risco\b/,
        /\bo melhor\b/,
        /\ba melhor\b/
    ];

    return patterns.some(
        pattern => pattern.test(text)
    );
}


function splitSentences(value) {
    return String(value || '')
        .split(/(?<=[.!?])\s+/)
        .map(item => item.trim())
        .filter(Boolean);
}


function sanitizeText(
    value,
    sourceText
) {
    if (!value) {
        return null;
    }

    const safe =
        splitSentences(value)
            .filter(sentence => {
                if (
                    hasUnsafeAbsoluteClaim(
                        sentence
                    )
                ) {
                    return false;
                }

                if (
                    hasUnsupportedNumber(
                        sentence,
                        sourceText
                    )
                ) {
                    return false;
                }

                return true;
            });

    return safe.join(' ').trim() || null;
}


function sanitizeCta(value) {
    const text =
        String(value || '').trim();

    if (!text) {
        return (
            'Veja os detalhes do produto ' +
            'e confira se ele combina com ' +
            'o que você procura.'
        );
    }

    const normalized =
        normalizeText(text);

    const badPatterns = [
        /\baguarde agora\b/,
        /\bcompre agora\b/,
        /\bcorra\b/,
        /\bultima chance\b/,
        /\bnao perca\b/
    ];

    if (
        badPatterns.some(
            pattern =>
                pattern.test(normalized)
        )
    ) {
        return (
            'Veja os detalhes do produto ' +
            'e confira se ele combina com ' +
            'o que você procura.'
        );
    }

    return text;
}


function sanitizeHashtags(values) {
    return (Array.isArray(values) ? values : [])
        .slice(0, 5)
        .map(value =>
            String(value || '')
                .trim()
                .replace(/^#/, '')
                .replace(/\s+/g, '')
        )
        .filter(Boolean)
        .map(value => `#${value}`);
}


function buildSafeFallback(productFacts) {
    const title =
        productFacts.title ||
        'este produto';

    return (
        `Conheça ${title}. ` +
        'Veja os detalhes e confira se ' +
        'esta opção combina com o que ' +
        'você procura.'
    );
}


function sanitizeGeneratedContent(
    content,
    productFacts
) {
    const sourceText =
        sourceTextForValidation(
            productFacts
        );

    const safeHeadline =
        sanitizeText(
            content.headline,
            sourceText
        ) ||
        productFacts.title ||
        null;

    const safeHook =
        sanitizeText(
            content.hook,
            sourceText
        );

    let safeBody =
        sanitizeText(
            content.body,
            sourceText
        );

    if (
        !safeBody ||
        safeBody.length < 40
    ) {
        safeBody =
            buildSafeFallback(
                productFacts
            );
    }

    const safeOverlay =
        sanitizeText(
            content.overlayText,
            sourceText
        ) ||
        productFacts.title ||
        null;

    const safeMediaInstruction =
        sanitizeText(
            content.mediaInstruction,
            sourceText
        ) ||
        (
            'Mostre o produto com clareza, ' +
            'sem adicionar características ' +
            'que não estejam nos dados reais.'
        );

    const safeAltText =
        sanitizeText(
            content.altText,
            sourceText
        ) ||
        (
            productFacts.title
                ? `Imagem de ${productFacts.title}`
                : 'Imagem do produto'
        );

    const warnings = [
        ...(
            Array.isArray(content.warnings)
                ? content.warnings
                : []
        ),
        'Conteúdo passou pela validação final automática.'
    ];

    return {
        ...content,

        headline:
            safeHeadline,

        hook:
            safeHook,

        body:
            safeBody,

        cta:
            sanitizeCta(
                content.cta
            ),

        overlayText:
            safeOverlay,

        hashtags:
            sanitizeHashtags(
                content.hashtags
            ),

        mediaInstruction:
            safeMediaInstruction,

        altText:
            safeAltText,

        warnings:
            [...new Set(warnings)]
    };
}


function buildTitleOnlyContent(
    productFacts,
    channel,
    format
) {
    const title =
        productFacts.title ||
        'Produto selecionado';

    return {
        itemId:
            productFacts.itemId,

        channel,

        format:
            format || null,

        provider:
            'system',

        model:
            'title-fallback',

        generatedAt:
            new Date().toISOString(),

        content: {
            channel,

            headline:
                title,

            hook:
                `Confira ${title}.`,

            body:
                `Conheça ${title}. ` +
                'Veja os detalhes do produto ' +
                'e confira se ele combina com ' +
                'o que você procura.',

            cta:
                'Veja os detalhes do produto.',

            overlayText:
                title,

            hashtags: [
                '#Achadinhos',
                '#Ofertas'
            ],

            mediaInstruction:
                'Mostre a imagem real do produto com clareza.',

            altText:
                `Imagem de ${title}`,

            warnings: [
                'Texto criado somente com base no título real do produto.',
                'Nenhuma característica adicional foi presumida.'
            ]
        }
    };
}


async function generateContent({
    product,
    plan,
    channel,
    format = null
}) {
    const channelRule =
        validateChannel(channel);

    const productFacts = {
        itemId:
            product?.itemId || null,

        title:
            product?.title || null,

        description:
            product?.description || null,

        currentPrice:
            product?.commercial?.price ??
            product?.offer?.currentPrice ??
            product?.price ??
            null,

        sales:
            product?.commercial?.sales ??
            null,

        productRating:
            product?.commercial?.rating ??
            product?.ratings?.product ??
            null,

        shopRating:
            product?.shop?.rating ??
            null,

        imageCount:
            product?.media?.imageCount ??
            0,

        videoCount:
            product?.media?.videoCount ??
            0
    };

    if (
        !productFacts.description ||
        !String(productFacts.description).trim()
    ) {
        return buildTitleOnlyContent(
            productFacts,
            channel,
            format
        );
    }

    const response =
        await generateAI({
            system: `
Você cria conteúdo comercial para marketing de afiliados.

REGRAS OBRIGATÓRIAS:

- Use somente os dados fornecidos.
- Siga o plano de comunicação recebido.
- Não invente características.
- Não invente benefícios.
- Não invente depoimentos.
- Não invente experiência pessoal.
- Não invente escassez ou urgência.
- Não use preço antigo.
- Não use percentual de desconto.
- Não prometa resultado.
- Não use frases como "o melhor" sem evidência.
- Não diga que você usou ou comprou o produto.
- Não transforme possibilidade em certeza.
- Não crie números, medidas ou especificações.
- O texto deve parecer natural e humano.
- Evite linguagem exagerada ou artificial.
- A chamada para compra deve despertar interesse,
  não pressionar o cliente.

ESTRUTURA DA COMUNICAÇÃO:

1. Gancho.
2. Dor ou desejo reconhecível.
3. Produto apresentado como solução possível.
4. Benefício sustentado pelos dados.
5. Chamada para ação.

CANAL:
${channelRule.name}

ESTILO:
${channelRule.style}
            `.trim(),

            prompt: `
PRODUTO:
${JSON.stringify(productFacts)}

PLANO DE COMUNICAÇÃO:
${JSON.stringify(plan)}

FORMATO:
${format || 'definir conforme o plano'}

Crie o conteúdo final para ${channelRule.name}.

Seja conciso.
Evite repetições.
Use no máximo 5 hashtags.
Não escreva explicações fora dos campos solicitados.

Responda SOMENTE JSON válido.

Use exatamente estes campos:

titulo:
título curto quando fizer sentido para o canal

gancho:
primeira frase que chama atenção

texto:
texto principal completo da publicação

cta:
chamada para ação natural

textoNaMidia:
frase curta para aparecer sobre foto ou vídeo

hashtags:
lista curta de hashtags realmente relacionadas

instrucaoMidia:
orientação de como apresentar o produto visualmente

textoAlternativo:
descrição objetiva da mídia para acessibilidade

alertas:
lista de afirmações que devem ser evitadas
            `.trim(),

            format: 'json',

            options: {
                timeoutMs: 20000,
                think: false,
                temperature: 0.4,
                num_predict: 700
            }
        });

    const parsed =
        parseJson(
            response.content
        );

    const normalized =
        normalizeContent(
            parsed,
            channel
        );

    const validated =
        sanitizeGeneratedContent(
            normalized,
            productFacts
        );

    return {
        itemId:
            productFacts.itemId,

        channel,

        format:
            format || null,

        provider:
            response.provider,

        model:
            response.model,

        generatedAt:
            new Date().toISOString(),

        content:
            validated
    };
}


module.exports = {
    CHANNEL_RULES,
    generateContent,
    sanitizeGeneratedContent
};

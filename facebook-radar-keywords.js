const fs = require('fs');
const path = require('path');

const catalogPath =
    path.join(__dirname, 'data/vitrine2-catalog.json');

function unique(values) {
    return [...new Set(
        values
            .map(v => String(v || '').trim())
            .filter(Boolean)
    )];
}

function generateKeywords(product) {
    const keywords = [];

    if (product.category3) {
        keywords.push(product.category3);
    }

    if (product.category2) {
        keywords.push(product.category2);
    }

    if (product.category1) {
        keywords.push(product.category1);
    }

    const title =
        String(product.title || '')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    if (title) {
        const words = title
            .split(' ')
            .filter(word => word.length >= 4)
            .slice(0, 6);

        if (words.length) {
            keywords.unshift(
                words.join(' ')
            );
        }
    }

    return unique(keywords).slice(0, 6);
}

function findPublishedProduct(itemId) {
    const data =
        JSON.parse(
            fs.readFileSync(
                catalogPath,
                'utf8'
            )
        );

    const entries =
        Array.isArray(data.entries)
            ? data.entries
            : [];

    return entries.find(entry => {
        if (!entry?.visibility?.published) {
            return false;
        }

        if (!itemId) {
            return true;
        }

        return String(
            entry?.product?.itemId
        ) === String(itemId);
    });
}

if (require.main === module) {
    const itemId =
        process.argv[2] || null;

    const entry =
        findPublishedProduct(itemId);

    if (!entry) {
        console.error(
            'Produto publicado não encontrado.'
        );
        process.exit(1);
    }

    const product =
        entry.product;

    console.log(
        JSON.stringify(
            {
                itemId: product.itemId,
                shopId: product.shopId,
                title: product.title,
                categories: [
                    product.category1,
                    product.category2,
                    product.category3
                ],
                radarKeywords:
                    generateKeywords(product)
            },
            null,
            2
        )
    );
}

module.exports = {
    generateKeywords,
    findPublishedProduct
};

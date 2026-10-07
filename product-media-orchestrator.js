'use strict';


const shopeeProvider =
    require(
        './product-media-providers/shopee'
    );


const providers = [
    shopeeProvider
];


function text(value) {
    const result =
        String(
            value ?? ''
        ).trim();

    return result || null;
}


function resolveProvider(
    input = {}
) {
    const marketplace =
        text(
            input.marketplace
        );

    if (marketplace) {
        const normalized =
            marketplace.toLowerCase();

        const provider =
            providers.find(
                item =>
                    item.marketplace ===
                    normalized
            );

        if (provider) {
            return provider;
        }
    }

    const provider =
        providers.find(
            item =>
                typeof item.canHandle ===
                    'function' &&
                item.canHandle(input)
        );

    if (!provider) {
        throw new Error(
            'Marketplace ainda não suportado pelo orquestrador de mídias.'
        );
    }

    return provider;
}


async function getProductMedia(
    input = {}
) {
    const provider =
        resolveProvider(
            input
        );

    return provider.getProductMedia(
        input
    );
}


function listProviders() {
    return providers.map(
        provider => ({
            marketplace:
                provider.marketplace
        })
    );
}


module.exports = {
    getProductMedia,
    resolveProvider,
    listProviders
};

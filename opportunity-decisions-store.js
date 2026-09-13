const fs = require('fs');
const path = require('path');


const STORE_FILE =
    path.join(
        __dirname,
        'data',
        'opportunity-decisions.json'
    );


function emptyState() {
    return {
        version: 1,
        saved: {},
        ignored: {}
    };
}


function createKey(
    marketplace,
    itemId
) {
    return (
        `${String(
            marketplace || ''
        ).trim().toLowerCase()}:${String(
            itemId || ''
        ).trim()}`
    );
}


function loadState() {

    try {

        if (
            !fs.existsSync(
                STORE_FILE
            )
        ) {
            return emptyState();
        }

        const parsed =
            JSON.parse(
                fs.readFileSync(
                    STORE_FILE,
                    'utf8'
                )
            );

        return {
            version: 1,

            saved:
                parsed?.saved &&
                typeof parsed.saved === 'object'
                    ? parsed.saved
                    : {},

            ignored:
                parsed?.ignored &&
                typeof parsed.ignored === 'object'
                    ? parsed.ignored
                    : {}
        };

    } catch (error) {

        console.error(
            '[OPPORTUNITY DECISIONS] Erro ao carregar:',
            error
        );

        return emptyState();
    }
}


function saveState(state) {

    fs.mkdirSync(
        path.dirname(
            STORE_FILE
        ),
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        STORE_FILE,
        JSON.stringify(
            state,
            null,
            2
        ) + '\n',
        'utf8'
    );
}


function saveForLater(product) {

    if (
        !product ||
        !product.itemId
    ) {
        throw new Error(
            'Produto inválido para salvar.'
        );
    }

    const marketplace =
        String(
            product.marketplace ||
            'shopee'
        )
            .trim()
            .toLowerCase();

    const itemId =
        String(
            product.itemId
        ).trim();

    const key =
        createKey(
            marketplace,
            itemId
        );

    const state =
        loadState();

    state.saved[key] = {
        marketplace,
        itemId,
        product,
        savedAt:
            new Date()
                .toISOString()
    };

    /*
     * Se estava ignorado e o usuário decidiu salvar,
     * deixa de estar ignorado.
     */
    delete state.ignored[key];

    saveState(
        state
    );

    return state.saved[key];
}


function ignoreProduct(product) {

    if (
        !product ||
        !product.itemId
    ) {
        throw new Error(
            'Produto inválido para ignorar.'
        );
    }

    const marketplace =
        String(
            product.marketplace ||
            'shopee'
        )
            .trim()
            .toLowerCase();

    const itemId =
        String(
            product.itemId
        ).trim();

    const key =
        createKey(
            marketplace,
            itemId
        );

    const state =
        loadState();

    state.ignored[key] = {
        marketplace,
        itemId,
        product,
        ignoredAt:
            new Date()
                .toISOString()
    };

    /*
     * Um produto ignorado não permanece
     * simultaneamente em "salvos".
     */
    delete state.saved[key];

    saveState(
        state
    );

    return state.ignored[key];
}


function removeSaved(
    marketplace,
    itemId
) {
    const state =
        loadState();

    const key =
        createKey(
            marketplace,
            itemId
        );

    const existed =
        Boolean(
            state.saved[key]
        );

    delete state.saved[key];

    saveState(
        state
    );

    return existed;
}


function removeIgnored(
    marketplace,
    itemId
) {
    const state =
        loadState();

    const key =
        createKey(
            marketplace,
            itemId
        );

    const existed =
        Boolean(
            state.ignored[key]
        );

    delete state.ignored[key];

    saveState(
        state
    );

    return existed;
}


function isIgnored(
    marketplace,
    itemId
) {
    const state =
        loadState();

    return Boolean(
        state.ignored[
            createKey(
                marketplace,
                itemId
            )
        ]
    );
}


function listSaved() {
    const state =
        loadState();

    return Object.values(
        state.saved
    );
}


function listIgnored() {
    const state =
        loadState();

    return Object.values(
        state.ignored
    );
}


function getSummary() {
    const state =
        loadState();

    return {
        saved:
            Object.keys(
                state.saved
            ).length,

        ignored:
            Object.keys(
                state.ignored
            ).length
    };
}


module.exports = {
    STORE_FILE,
    createKey,
    saveForLater,
    ignoreProduct,
    removeSaved,
    removeIgnored,
    isIgnored,
    listSaved,
    listIgnored,
    getSummary
};

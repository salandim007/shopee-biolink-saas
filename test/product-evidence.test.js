'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createProductEvidenceService
} = require('../product-evidence');


function createFeedFixture(rows) {
    let scans = 0;

    return {
        get scans() {
            return scans;
        },

        async readFeed(
            csvFile,
            callback
        ) {
            assert.equal(
                csvFile.name,
                'fixture.csv'
            );

            scans++;

            for (const row of rows) {
                const shouldStop =
                    await callback(row);

                if (shouldStop === true) {
                    break;
                }
            }
        }
    };
}


test(
    'une vários produtos em uma única varredura do feed',
    async () => {
        const feed =
            createFeedFixture([
                {
                    itemid: '100',
                    title: 'Título do feed 100',
                    description: 'Descrição factual 100',
                    global_item_attributes:
                        '[{"name":"Material","value":"Aço"}]',
                    global_catid1: '10',
                    global_category1: 'Home & Living',
                    global_catid2: '20',
                    global_category2: 'Kitchen',
                    global_catid3: '30',
                    global_category3: 'Utensils',
                    price: '99.90',
                    sale_price: '79.90'
                },
                {
                    itemid: '200',
                    title: 'Título do feed 200',
                    description: '',
                    global_item_attributes: '',
                    global_category1: 'Beauty',
                    global_category2: '',
                    global_category3: ''
                }
            ]);

        const service =
            createProductEvidenceService({
                readFeed:
                    feed.readFeed,

                getLatestCsvFile() {
                    return {
                        name: 'fixture.csv'
                    };
                }
            });

        const apiProducts = [
            {
                itemId: 100,
                productName: 'Título atual 100',
                price: 75.5,
                sales: 321,
                ratingStar: 4.9
            },
            {
                itemId: '200',
                productName: 'Título atual 200',
                price: 25,
                sales: 10
            }
        ];

        const evidence =
            await service.fromApiProducts(
                apiProducts
            );

        assert.equal(feed.scans, 1);
        assert.equal(evidence.length, 2);

        assert.deepEqual(
            evidence[0].commercial,
            apiProducts[0]
        );

        assert.equal(
            evidence[0].factual.description,
            'Descrição factual 100'
        );

        assert.equal(
            evidence[0].factual.globalItemAttributes,
            '[{"name":"Material","value":"Aço"}]'
        );

        assert.equal(
            evidence[0].factual.globalCategory1,
            'Home & Living'
        );

        assert.equal(
            evidence[0].factual.salePrice,
            '79.90'
        );

        assert.deepEqual(
            evidence[0].provenance,
            {
                commercialSource:
                    'Shopee Affiliate Open API',
                factualSource:
                    'Shopee Data Feed',
                feedFile:
                    'fixture.csv',
                matchedBy:
                    'itemId'
            }
        );

        assert.equal(
            evidence[1].factual.description,
            null
        );

        assert.equal(
            evidence[1].factual.globalItemAttributes,
            null
        );
    }
);


test(
    'retorna factual null quando o itemId não existe no feed',
    async () => {
        const feed =
            createFeedFixture([
                {
                    itemid: '999',
                    description: 'Outro produto'
                }
            ]);

        const service =
            createProductEvidenceService({
                readFeed:
                    feed.readFeed,

                getLatestCsvFile() {
                    return {
                        name: 'fixture.csv'
                    };
                }
            });

        const [evidence] =
            await service.fromApiProducts([
                {
                    itemId: '404',
                    productName: 'Somente API',
                    price: 12
                }
            ]);

        assert.equal(feed.scans, 1);
        assert.equal(evidence.factual, null);

        assert.deepEqual(
            evidence.provenance,
            {
                commercialSource:
                    'Shopee Affiliate Open API',
                factualSource: null,
                feedFile: null,
                matchedBy: null
            }
        );
    }
);


test(
    'mantém em memória somente produtos encontrados',
    async () => {
        const feed =
            createFeedFixture([
                {
                    itemid: '100',
                    description: 'Encontrado'
                }
            ]);

        const service =
            createProductEvidenceService({
                readFeed:
                    feed.readFeed,

                getLatestCsvFile() {
                    return {
                        name: 'fixture.csv'
                    };
                }
            });

        await service.fromApiProducts([
            { itemId: '100' }
        ]);

        await service.fromApiProducts([
            { itemId: '100' }
        ]);

        assert.equal(
            feed.scans,
            1,
            'item encontrado deve vir do cache'
        );

        await service.fromApiProducts([
            { itemId: '404' }
        ]);

        await service.fromApiProducts([
            { itemId: '404' }
        ]);

        assert.equal(
            feed.scans,
            3,
            'item ausente não deve ser guardado no cache'
        );
    }
);


test(
    'busca dados comerciais por itemId antes de unir ao feed',
    async () => {
        const requestedItemIds = [];
        const feed =
            createFeedFixture([
                {
                    itemid: '100',
                    description: 'Descrição 100'
                },
                {
                    itemid: '200',
                    description: 'Descrição 200'
                }
            ]);

        const service =
            createProductEvidenceService({
                readFeed:
                    feed.readFeed,

                getLatestCsvFile() {
                    return {
                        name: 'fixture.csv'
                    };
                },

                async fetchProductOfferByItemId(
                    itemId
                ) {
                    requestedItemIds.push(
                        itemId
                    );

                    return {
                        product: {
                            itemId,
                            price:
                                itemId === '100'
                                    ? 10
                                    : 20
                        }
                    };
                }
            });

        const evidence =
            await service.fromItemIds([
                100,
                '200'
            ]);

        assert.deepEqual(
            requestedItemIds,
            ['100', '200']
        );

        assert.equal(feed.scans, 1);
        assert.equal(
            evidence[0].commercial.price,
            10
        );
        assert.equal(
            evidence[1].factual.description,
            'Descrição 200'
        );
    }
);


test(
    'aceita caminho explícito sem alterar a seleção padrão',
    async () => {
        let defaultSelections = 0;
        let receivedCsvFile = null;

        const service =
            createProductEvidenceService({
                getLatestCsvFile() {
                    defaultSelections++;

                    return {
                        name: 'default.csv'
                    };
                },

                async readFeed(
                    csvFile,
                    callback
                ) {
                    receivedCsvFile =
                        csvFile;

                    await callback({
                        itemid: '100',
                        description:
                            'CSV explícito'
                    });
                }
            });

        const [evidence] =
            await service.fromApiProducts(
                [
                    { itemId: '100' }
                ],
                {
                    csvFilePath:
                        'fixtures/feed.csv'
                }
            );

        assert.equal(
            defaultSelections,
            0
        );

        assert.equal(
            receivedCsvFile.name,
            'feed.csv'
        );

        assert.equal(
            receivedCsvFile.sourcePath,
            'fixtures\\feed.csv'
        );

        assert.equal(
            evidence.factual.description,
            'CSV explícito'
        );

        assert.equal(
            evidence.provenance.feedFile,
            'fixtures\\feed.csv'
        );
    }
);

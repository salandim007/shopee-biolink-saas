'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createEvidenceAuditor
} = require('../marketing/evidence-auditor');


const evidence = {
    marketplace: 'shopee',
    itemId: '123',

    commercial: {
        productName:
            'Mousepad temático',

        commission:
            '99.99'
    },

    factual: {
        description:
            'Possui apoio para os pulsos e base antiderrapante.',

        globalCategory1:
            'Computers & Accessories'
    }
};


test(
    'aprova claim sustentada pela evidência factual',
    async () => {
        const auditor =
            createEvidenceAuditor();

        const result =
            await auditor.audit(
                evidence,
                {
                    caption:
                        'Possui apoio para os pulsos.',

                    claims: [
                        {
                            text:
                                'Possui apoio para os pulsos.'
                        }
                    ]
                }
            );

        assert.equal(
            result.status,
            'APPROVED'
        );

        assert.equal(
            result.claims[0].status,
            'SUPPORTED'
        );

        assert.equal(
            result.claims[0]
                .evidence[0]
                .field,
            'description'
        );
    }
);


test(
    'rejeita claim sem evidência',
    async () => {
        const auditor =
            createEvidenceAuditor();

        const result =
            await auditor.audit(
                evidence,
                {
                    caption:
                        'Também protege os ombros.',

                    claims: [
                        {
                            text:
                                'Também protege os ombros.'
                        }
                    ]
                }
            );

        assert.equal(
            result.status,
            'REJECTED'
        );

        assert.equal(
            result.claims[0].status,
            'UNSUPPORTED'
        );

        assert.deepEqual(
            result.claims[0].evidence,
            []
        );
    }
);


test(
    'rejeita inferência que não está comprovada diretamente',
    async () => {
        const auditor =
            createEvidenceAuditor();

        const result =
            await auditor.audit(
                evidence,
                {
                    caption:
                        'Nunca se move durante o uso.',

                    claims: [
                        {
                            text:
                                'Nunca se move durante o uso.'
                        }
                    ]
                }
            );

        assert.equal(
            result.status,
            'REJECTED'
        );

        assert.equal(
            result.claims[0].status,
            'UNSUPPORTED'
        );
    }
);


test(
    'não usa comissão interna como prova pública',
    async () => {
        const auditor =
            createEvidenceAuditor();

        const result =
            await auditor.audit(
                evidence,
                {
                    caption:
                        'Paga comissão de 99,99.',

                    claims: [
                        {
                            text:
                                'Paga comissão de 99,99.'
                        }
                    ]
                }
            );

        assert.equal(
            result.status,
            'REJECTED'
        );
    }
);

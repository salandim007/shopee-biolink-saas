'use strict';

const COVER_TEMPLATES = Object.freeze([
    {
        id: 'oferta-premium',

        name: 'Oferta Premium',

        description:
            'Capa com visual mais elegante, foco maior no produto e tipografia forte.',

        width: 1280,
        height: 720,

        defaults: {
            headline: 'OFERTA ESPECIAL',
            subheadline: 'DESTAQUE DO DIA',
            badge: 'QUALIDADE',
            cta: 'SAIBA MAIS'
        },

        fields: {
            productImage: true,
            headline: true,
            subheadline: true,
            badge: true,
            cta: true,
            price: true
        },

        layout: {
            productSide: 'right',
            textSide: 'left',
            style: 'premium-clean',
            background: 'orange-cream-gold'
        }
    },


    {
        id: 'oferta-forte',
        name: 'Oferta Forte',
        description:
            'Capa chamativa para ofertas, achadinhos e produtos em destaque.',
        width: 1280,
        height: 720,
        defaults: {
            headline: 'ACHADO IMPERDÍVEL!',
            subheadline: 'VEJA ESSE PRODUTO',
            badge: 'TOP OFERTA',
            cta: 'CONFIRA AGORA'
        },
        fields: {
            productImage: true,
            headline: true,
            subheadline: true,
            badge: true,
            cta: true,
            price: true
        },
        layout: {
            productSide: 'right',
            textSide: 'left',
            style: 'high-impact',
            background: 'red-yellow'
        }
    }
]);

function listCoverTemplates() {
    return COVER_TEMPLATES.map(item => ({ ...item }));
}

function getCoverTemplateById(id) {
    return (
        COVER_TEMPLATES.find(
            item => item.id === String(id || '').trim()
        ) || null
    );
}

module.exports = {
    COVER_TEMPLATES,
    listCoverTemplates,
    getCoverTemplateById
};

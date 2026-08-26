'use strict';

const express =
    require('express');

const router =
    express.Router();

const pages = {
    overview: {
        view: 'marketing-overview',
        title: 'Visão Geral'
    },

    instagram: {
        view: 'marketing-instagram',
        title: 'Instagram'
    },

    facebook: {
        view: 'marketing-facebook',
        title: 'Facebook'
    },

    tiktok: {
        view: 'marketing-tiktok',
        title: 'TikTok'
    },

    kwai: {
        view: 'marketing-kwai',
        title: 'Kwai'
    },

    outros: {
        view: 'marketing-outros',
        title: 'Outros canais'
    }
};


router.get(
    '/',
    (req, res) => {
        res.redirect(
            '/admin/vitrine2/marketing/overview'
        );
    }
);


Object.entries(
    pages
).forEach(
    ([
        slug,
        page
    ]) => {
        router.get(
            `/${slug}`,
            (req, res) => {
                res.render(
                    page.view,
                    {
                        activeMarketingPage:
                            slug,

                        marketingPageTitle:
                            page.title
                    }
                );
            }
        );
    }
);


module.exports =
    router;

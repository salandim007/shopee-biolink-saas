'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API = 'https://open-api.affiliate.shopee.com.br/graphql';
const REF = '428536169534861312';
const LIMIT = 500;

const ROOT = '/app/data/shopee-feed-api';
const CHECK = path.join(ROOT, 'checkpoints/full-official.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function auth(body) {
    const id = process.env.SHOPEE_AFFILIATE_APP_ID;
    const secret = process.env.SHOPEE_AFFILIATE_SECRET;
    const ts = Math.floor(Date.now() / 1000).toString();

    const sig = crypto.createHash('sha256')
        .update(id + ts + body + secret)
        .digest('hex');

    return `SHA256 Credential=${id}, Timestamp=${ts}, Signature=${sig}`;
}

async function gql(query) {
    const body = JSON.stringify({ query });

    const r = await fetch(API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: auth(body)
        },
        body
    });

    const j = await r.json();

    if (j.errors) {
        throw new Error(j.errors.map(e => e.message).join(' | '));
    }

    return j.data;
}

async function retry(fn) {
    let last;

    for (let n = 1; n <= 5; n++) {
        try {
            return await fn();
        } catch (e) {
            last = e;
            console.log(`Tentativa ${n}/5 falhou: ${e.message}`);
            await sleep(n * 2000);
        }
    }

    throw last;
}

(async () => {
    fs.mkdirSync(path.dirname(CHECK), { recursive: true });

    const list = await retry(() => gql(`
        query {
          listItemFeeds(feedMode:FULL) {
            feeds {
              datafeedId
              referenceId
              datafeedName
              totalCount
              date
            }
          }
        }
    `));

    const feed = list.listItemFeeds.feeds
        .find(f => f.referenceId === REF);

    if (!feed) throw new Error('Feed oficial não encontrado.');

    const dir = path.join(ROOT, 'full', feed.datafeedId);
    fs.mkdirSync(dir, { recursive: true });

    let state = { datafeedId: feed.datafeedId, offset: 0 };

    if (fs.existsSync(CHECK)) {
        const old = JSON.parse(fs.readFileSync(CHECK, 'utf8'));

        if (old.datafeedId === feed.datafeedId) {
            state = old;
        }
    }

    console.log('Feed:', feed.datafeedName);
    console.log('Data:', feed.date);
    console.log('Total:', feed.totalCount);
    console.log('Retomando offset:', state.offset);

    while (state.offset < feed.totalCount) {
        const offset = state.offset;

        const data = await retry(() => gql(`
            query {
              getItemFeedData(
                datafeedId:"${feed.datafeedId}"
                offset:${offset}
                limit:${LIMIT}
              ) {
                rows { columns updateType }
                pageInfo { hasMore totalCount }
              }
            }
        `));

        const rows = data.getItemFeedData.rows.map(r => ({
            ...JSON.parse(r.columns),
            updateType: r.updateType
        }));

        const name =
            `offset-${String(offset).padStart(6, '0')}.json`;

        const tmp = path.join(dir, name + '.tmp');
        const dest = path.join(dir, name);

        fs.writeFileSync(tmp, JSON.stringify(rows));
        fs.renameSync(tmp, dest);

        state.offset = offset + rows.length;

        const checkTmp = CHECK + '.tmp';
        fs.writeFileSync(checkTmp, JSON.stringify(state, null, 2));
        fs.renameSync(checkTmp, CHECK);

        console.log(
            `OK ${state.offset}/${feed.totalCount}`
        );

        if (!data.getItemFeedData.pageInfo.hasMore) break;

        await sleep(800);
    }

    console.log('DOWNLOAD FULL CONCLUIDO');
})();

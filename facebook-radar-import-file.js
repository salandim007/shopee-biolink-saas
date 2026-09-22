const fs = require('fs');
const radar = require('./facebook-group-radar-store');

const file = process.argv[2];

if (!file) {
    console.error('Arquivo JSON não informado.');
    process.exit(1);
}

function getGroupId(url) {
    try {
        const parsed = new URL(url);
        const parts = parsed.pathname
            .split('/')
            .filter(Boolean);

        if (
            parts[0] !== 'groups' ||
            !parts[1] ||
            parts[1] === 'search'
        ) {
            return null;
        }

        return parts[1];
    } catch {
        return null;
    }
}

(async () => {
    await radar.initFacebookGroupRadarStore();

    const data = JSON.parse(
        fs.readFileSync(file, 'utf8')
    );

    const groups = Array.isArray(data.groups)
        ? data.groups
        : [];

    let imported = 0;
    let ignored = 0;

    for (const item of groups) {
        const groupId = getGroupId(item.url);

        if (!groupId) {
            ignored++;
            continue;
        }

        await radar.upsertGroup({
            facebookGroupId: groupId,

            name:
                item.name ||
                groupId,

            url:
                `https://www.facebook.com/groups/${groupId}/`,

            privacy:
                item.privacy ||
                'Unknown',

            membershipStatus:
                item.membershipStatus ||
                'Unknown',

            membersCount:
                item.membersCount ||
                0,

            status:
                'DISCOVERED',

            source:
                'fb_validador_auto'
        });

        imported++;
    }

    console.log('===== RADAR IMPORT =====');
    console.log('Recebidos:', groups.length);
    console.log('Importados:', imported);
    console.log('Ignorados:', ignored);

    const stats = await radar.getStats();

    console.log('Total no Radar:', stats.groups.total);

    process.exit(0);
})().catch(error => {
    console.error(error);
    process.exit(1);
});

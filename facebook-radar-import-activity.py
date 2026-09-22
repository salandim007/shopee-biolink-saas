import sys
import json
import sqlite3
from pathlib import Path

if len(sys.argv) != 2:
    print("Uso: facebook-radar-import-activity.py arquivo.json")
    sys.exit(1)

arquivo = Path(sys.argv[1])

with arquivo.open(encoding="utf-8") as f:
    d = json.load(f)

gid = str(d.get("facebookGroupId", "")).strip()

if not gid:
    raise SystemExit("ERRO: facebookGroupId ausente")

db = sqlite3.connect("database.sqlite")

grupo = db.execute(
    """
    SELECT id
    FROM facebook_groups
    WHERE facebook_group_id=?
    """,
    (gid,)
).fetchone()

if not grupo:
    db.close()
    raise SystemExit(
        f"ERRO: grupo {gid} nao encontrado no Radar"
    )

db.execute(
    """
    UPDATE facebook_groups
    SET
        name=COALESCE(NULLIF(?, ''), name),
        status=COALESCE(NULLIF(?, ''), status),
        group_posts_today=COALESCE(?, group_posts_today),
        group_posts_last_month=COALESCE(?, group_posts_last_month),
        members_count=COALESCE(?, members_count),
        members_growth_week=COALESCE(?, members_growth_week),
        group_activity_checked_at=COALESCE(?, group_activity_checked_at),
        updated_at=CURRENT_TIMESTAMP
    WHERE facebook_group_id=?
    """,
    (
        d.get("groupName"),
        d.get("groupStatus"),
        d.get("groupPostsToday"),
        d.get("groupPostsLastMonth"),
        d.get("membersCount"),
        d.get("membersGrowthWeek"),
        d.get("collectedAt"),
        gid
    )
)

db.commit()
db.close()

print("ATIVIDADE IMPORTADA:", gid)

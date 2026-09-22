import csv
import re
import sqlite3
import sys
from datetime import datetime, timezone

arquivo = sys.argv[1]
db = sqlite3.connect("database.sqlite", timeout=10)
db.execute("PRAGMA foreign_keys = ON")

with open(arquivo, encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f, delimiter=";"))

joined = [
    r for r in rows
    if r.get("Participacao", "").strip() == "Ja participa"
]

importados = 0

for r in joined:
    gid = r.get("Id", "").strip()
    if not gid:
        continue

    nome = r.get("Nome", "").strip()
    if not nome or nome == "Grupos":
        nome = gid

    membros_txt = r.get("Membros", "")
    digits = re.sub(r"\D", "", membros_txt)
    membros = int(digits) if digits else 0

    privacy = r.get("Privacidade", "").strip()
    keyword = r.get("Palavra-chave", "").strip()
    url = f"https://www.facebook.com/groups/{gid}/"

    row = db.execute(
        "SELECT id, name, privacy, members_count FROM facebook_groups WHERE facebook_group_id = ?",
        (gid,)
    ).fetchone()

    if row:
        group_id = row[0]

        db.execute("""
            UPDATE facebook_groups
            SET
                name = CASE
                    WHEN ? != ? THEN ?
                    ELSE name
                END,
                privacy = CASE
                    WHEN ? NOT IN ('', 'Nao identificado', 'Unknown')
                    THEN ?
                    ELSE privacy
                END,
                members_count = CASE
                    WHEN ? > 0 THEN ?
                    ELSE members_count
                END,
                membership_status = 'Ja participa',
                source = 'fb_validador_joined',
                last_validated_at = ?,
                last_seen_csv_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            nome, gid, nome,
            privacy, privacy,
            membros, membros,
            datetime.now(timezone.utc).isoformat(),
            datetime.now(timezone.utc).isoformat(),
            group_id
        ))

    else:
        cur = db.execute("""
            INSERT INTO facebook_groups (
                facebook_group_id,
                name,
                url,
                privacy,
                members_count,
                membership_status,
                can_join,
                status,
                source,
                last_validated_at
            )
            VALUES (?, ?, ?, ?, ?, 'Ja participa', 0, 'ACTIVE', ?, ?)
        """, (
            gid, nome, url, privacy, membros,
            "fb_validador_joined",
            datetime.now(timezone.utc).isoformat()
        ))

        group_id = cur.lastrowid

    if keyword:
        db.execute("""
            INSERT OR IGNORE INTO facebook_group_tags (
                group_id,
                tag,
                tag_type,
                source
            )
            VALUES (?, ?, 'discovery', 'fb_validador')
        """, (group_id, keyword))

    importados += 1

nao_confirmados = 0

# IMPORTACAO SEGURA:
# CSV automatico adiciona/atualiza grupos,
# mas nunca remove participacao de grupos antigos.
# Isso evita que CSV parcial bagunce a base.

db.commit()

total = db.execute(
    "SELECT COUNT(*) FROM facebook_groups WHERE membership_status = 'Ja participa'"
).fetchone()[0]

db.close()

print("Ja participa encontrados:", len(joined))
print("Importados/atualizados:", importados)
print("Nao confirmados neste CSV:", nao_confirmados)
print("Total valido no Radar:", total)

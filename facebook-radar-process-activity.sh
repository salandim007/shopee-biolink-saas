#!/bin/bash

BASE="/opt/shopee-biolink-saas"
INBOX="$BASE/data/facebook-radar/activity-inbox"
OK="$BASE/data/facebook-radar/activity-processed"
FAIL="$BASE/data/facebook-radar/activity-failed"
STATUS="$BASE/data/facebook-radar/activity-status.json"

cd "$BASE" || exit 1
shopt -s nullglob

TOTAL=0
SUCESSO=0
FALHAS=0

for FILE in "$INBOX"/*.json
do
    TOTAL=$((TOTAL+1))
    NAME="$(basename "$FILE")"

    if python3 facebook-radar-import-activity.py "$FILE"
    then
        mv "$FILE" "$OK/$NAME"
        SUCESSO=$((SUCESSO+1))
    else
        mv "$FILE" "$FAIL/$NAME"
        FALHAS=$((FALHAS+1))
    fi
done

if [ "$TOTAL" -eq 0 ]; then
    echo "NENHUM ARQUIVO NOVO"
    exit 0
fi

python3 - "$STATUS" "$TOTAL" "$SUCESSO" "$FALHAS" <<'PY'
import json, sys
from datetime import datetime, timezone

arquivo=sys.argv[1]

dados={
    "updatedAt": datetime.now(timezone.utc).isoformat(),
    "filesProcessed": int(sys.argv[2]),
    "groupsUpdated": int(sys.argv[3]),
    "failures": int(sys.argv[4]),
    "success": int(sys.argv[4]) == 0
}

with open(arquivo,"w",encoding="utf-8") as f:
    json.dump(dados,f,indent=2)

print("STATUS GRAVADO")
PY

echo "PROCESSADOS: $TOTAL"
echo "SUCESSO: $SUCESSO"
echo "FALHAS: $FALHAS"

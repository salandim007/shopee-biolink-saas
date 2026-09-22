#!/bin/bash

BASE="/opt/shopee-biolink-saas"
INBOX="$BASE/data/facebook-radar/inbox"
PROCESSED="$BASE/data/facebook-radar/processed"
FAILED="$BASE/data/facebook-radar/failed"

cd "$BASE" || exit 1

shopt -s nullglob

# CSV = fonte oficial do Radar
for FILE in "$INBOX"/*.csv
do
    NAME="$(basename "$FILE")"

    echo "Processando CSV: $NAME"

    if python3 \
        "$BASE/facebook-radar-import-csv.py" \
        "$FILE"
    then
        mv "$FILE" "$PROCESSED/$NAME"
        echo "OK CSV: $NAME"
    else
        mv "$FILE" "$FAILED/$NAME"
        echo "FALHA CSV: $NAME"
    fi
done

# JSON fica apenas arquivado.
for FILE in "$INBOX"/*.json
do
    NAME="$(basename "$FILE")"

    mv "$FILE" "$PROCESSED/$NAME"

    echo "JSON arquivado: $NAME"
done

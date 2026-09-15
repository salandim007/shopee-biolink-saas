import json
import csv
from pathlib import Path

ORIGEM = Path("data/vitrine2-catalog.json")
SAIDA = Path("data/meta/catalog_vitrine2.csv")

SAIDA.parent.mkdir(parents=True, exist_ok=True)


def texto(valor):
    return str(valor or "").strip()


def criar_product_type(produto):
    categorias = [
        texto(produto.get("category1")),
        texto(produto.get("category2")),
        texto(produto.get("category3")),
    ]

    categorias = [categoria for categoria in categorias if categoria]

    return " > ".join(categorias)


def criar_descricao(produto, titulo):
    descricao_original = texto(produto.get("description"))

    if descricao_original and descricao_original.casefold() != titulo.casefold():
        return descricao_original

    categoria3 = texto(produto.get("category3"))
    categoria2 = texto(produto.get("category2"))
    categoria1 = texto(produto.get("category1"))

    categoria = categoria3 or categoria2 or categoria1

    if categoria:
        return (
            f"Confira {titulo}, produto da categoria {categoria}. "
            "Consulte preço, disponibilidade e condições atualizadas "
            "diretamente na página da oferta na Shopee."
        )

    return (
        f"Confira {titulo}. "
        "Consulte preço, disponibilidade e condições atualizadas "
        "diretamente na página da oferta na Shopee."
    )


with ORIGEM.open("r", encoding="utf-8") as f:
    dados = json.load(f)

campos = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
    "identifier_exists",
    "product_type",
]

linhas = []

for e in dados.get("entries", []):
    if e.get("visibility", {}).get("published") is not True:
        continue

    p = e.get("product", {})

    item_id = texto(p.get("itemId"))
    shop_id = texto(p.get("shopId"))
    titulo = texto(p.get("title"))

    if not item_id or not titulo:
        continue

    brand = texto(p.get("brand"))

    preco = p.get("price")
    moeda = p.get("currency") or "BRL"

    linhas.append({
        "id": (
            f"shopee-{shop_id}-{item_id}"
            if shop_id
            else f"shopee-{item_id}"
        ),
        "title": titulo,
        "description": criar_descricao(p, titulo),
        "availability": "in stock",
        "condition": "new",
        "price": (
            f"{preco:.2f} {moeda}"
            if isinstance(preco, (int, float))
            else ""
        ),
        "link": p.get("affiliateLink") or "",
        "image_link": p.get("image") or "",
        "brand": brand,
        "identifier_exists": "" if brand else "no",
        "product_type": criar_product_type(p),
    })

tmp = SAIDA.with_suffix(".tmp")

with tmp.open("w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=campos)
    writer.writeheader()
    writer.writerows(linhas)

tmp.replace(SAIDA)

print(f"Feed Meta atualizado: {len(linhas)} produtos")

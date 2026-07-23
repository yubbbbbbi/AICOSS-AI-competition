import json
import re
from pathlib import Path


ROOT = Path("C:/AICOSS")
NAVER_PATH = Path("C:/Users/seong/OneDrive/문서/카카오톡 받은 파일/RAGDB_naver_menus_with_images.json")
RECIPE_PATH = Path("C:/Users/seong/OneDrive/문서/카카오톡 받은 파일/RAGDB_menus_with_recipes.json")
OUT_PATH = ROOT / "demo" / "data" / "rag-reference-data.json"

HERB_ALIASES = {
    "민트": "박하",
}


def load_json(path):
    with path.open("r", encoding="utf-8-sig") as f:
        return json.load(f)


def compact_text(value, limit=150):
    value = " ".join(str(value or "").split())
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def clean_menu_name(value):
    value = str(value or "")
    value = re.sub(r"^[\s★☆*ㆍ·\-\[\]()] +", "", value)
    value = re.sub(r"^[\s★☆*ㆍ·\-\[\]()]+", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def search_text(*values):
    return " ".join(str(v or "") for v in values).lower()


def normalize_menu(menu):
    clean_name = clean_menu_name(menu.get("menu_name", ""))
    description = compact_text(menu.get("description", ""), 120)
    cafe = menu.get("cafe_name", "")
    return {
        "id": menu.get("menu_id"),
        "name": clean_name,
        "rawName": menu.get("menu_name", ""),
        "cafe": cafe,
        "description": description,
        "priceKrw": menu.get("price_krw"),
        "type": menu.get("menu_type", ""),
        "imageUrl": menu.get("image_url") if menu.get("has_image") else "",
        "imageSource": menu.get("image_source_type", ""),
        "sourceUrl": menu.get("source_url", ""),
        "matchedHerbs": menu.get("matched_herbs", []),
        "searchText": search_text(clean_name, description, cafe, " ".join(menu.get("matched_herbs", []))),
    }


def normalize_recipe(recipe):
    ingredients = recipe.get("ingredients", [])
    directions = recipe.get("directions", [])
    ner = recipe.get("ner", [])
    title_ko = recipe.get("title_ko", "")
    title_en = recipe.get("title_en", "")
    ingredient_preview = compact_text(", ".join(ner or ingredients), 160)
    step_preview = compact_text(" ".join(directions[:3]), 220)
    return {
        "id": str(recipe.get("source_row", "")),
        "rank": recipe.get("rank"),
        "score": recipe.get("score"),
        "titleKo": title_ko,
        "titleEn": title_en,
        "source": recipe.get("source", ""),
        "link": recipe.get("link", ""),
        "ingredients": ingredients[:16],
        "ingredientPreview": ingredient_preview,
        "steps": directions[:6],
        "stepPreview": step_preview,
        "searchText": search_text(title_ko, title_en, ingredient_preview, step_preview, " ".join(ingredients)),
    }


def canonical_herb_ko(name):
    return HERB_ALIASES.get(name, name)


def main():
    naver = load_json(NAVER_PATH)
    recipes = load_json(RECIPE_PATH)

    herbs = {}

    for item in naver.get("by_herb", []):
        herb_ko = canonical_herb_ko(item["herb_ko"])
        herbs.setdefault(herb_ko, {
            "herbKo": herb_ko,
            "herbEn": item.get("herb_en", ""),
            "cafeRefs": [],
            "recipeRefs": [],
        })
        menus = sorted(
            item.get("menus", []),
            key=lambda m: (
                0 if m.get("has_image") else 1,
                0 if m.get("description") else 1,
                m.get("price_krw") is None,
                clean_menu_name(m.get("menu_name", "")),
            ),
        )
        herbs[herb_ko]["cafeRefs"] = [normalize_menu(menu) for menu in menus]

    for recipe in recipes.get("recipes", []):
        herb_ko = canonical_herb_ko(recipe["ingredient_ko"])
        herbs.setdefault(herb_ko, {
            "herbKo": herb_ko,
            "herbEn": recipe.get("ingredient_en", ""),
            "cafeRefs": [],
            "recipeRefs": [],
        })
        herbs[herb_ko]["recipeRefs"].append(normalize_recipe(recipe))

    ordered = sorted(
        herbs.values(),
        key=lambda h: (
            -len(h["cafeRefs"]),
            -len(h["recipeRefs"]),
            h["herbKo"],
        ),
    )

    for herb in ordered:
        herb["counts"] = {
            "cafe": len(herb["cafeRefs"]),
            "cafeWithImage": sum(1 for item in herb["cafeRefs"] if item["imageUrl"]),
            "recipe": len(herb["recipeRefs"]),
        }
        herb["topCafeRefs"] = herb["cafeRefs"][:12]
        herb["topRecipeRefs"] = sorted(
            herb["recipeRefs"],
            key=lambda r: (r.get("rank") is None, r.get("rank") or 9999, -(r.get("score") or 0)),
        )[:12]

    output = {
        "metadata": {
            "description": "RAG reference dataset for the demo: Naver real cafe menu references with images plus global recipe references without images.",
            "naverUniqueMenuCount": naver.get("metadata", {}).get("unique_menu_count"),
            "naverUniqueMenuWithImageCount": naver.get("metadata", {}).get("unique_menu_with_image_count"),
            "globalRecipeCount": len(recipes.get("recipes", [])),
            "herbCount": len(ordered),
            "generatedFrom": [
                str(NAVER_PATH),
                str(RECIPE_PATH),
            ],
        },
        "herbs": ordered,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(OUT_PATH)
    print(json.dumps(output["metadata"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

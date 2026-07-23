from __future__ import annotations

import json
import re
from pathlib import Path

from export_korean_ranked_counts import to_korean


EXTRA_TOP20_TRANSLATIONS = {
    "sultana": "술타나건포도",
    "lemon peel": "레몬껍질",
    "currant": "커런트",
    "cooking apple": "조리용사과",
    "gelatin powder": "젤라틴가루",
    "lindisfarne mead": "미드주",
    "double cream": "더블크림",
    "dashi": "다시",
    "dashi stock": "다시육수",
    "taro root": "토란",
    "miso": "미소된장",
    "tofu": "두부",
    "water chestnut": "물밤",
    "rye flour": "호밀가루",
    "cider vinegar": "사과식초",
    "onion flake": "건조양파",
    "caraway seed": "캐러웨이씨드",
    "cocoa powder": "코코아가루",
    "coconut milk": "코코넛밀크",
    "banana": "바나나",
    "dijon mustard": "디종머스터드",
    "orange juice concentrate": "오렌지농축액",
    "vodka": "보드카",
    "cardamom": "카다몬",
    "orange zest": "오렌지제스트",
    "tang orange crystal": "오렌지분말",
    "strawberry": "딸기",
    "lamb": "양고기",
    "couscous": "쿠스쿠스",
    "saffron": "사프란",
}


def translate_ingredient(value: str) -> str:
    lower = value.strip().lower()
    if lower in EXTRA_TOP20_TRANSLATIONS:
        return EXTRA_TOP20_TRANSLATIONS[lower]
    translated = to_korean(value)
    return EXTRA_TOP20_TRANSLATIONS.get(translated.lower(), translated)


def main() -> None:
    input_path = Path("data/recipedb_10plus/final_ranked_ingredients.json")
    output_path = Path("data/recipedb_10plus/final_ranked_ingredients_top20_ko_only.json")

    with input_path.open(encoding="utf-8") as file:
        data = json.load(file)

    result = []
    leftovers = []
    for herb in data:
        ingredients = []
        for item in herb["ingredients"][:20]:
            translated = translate_ingredient(item["ingredient"])
            if re.search(r"[A-Za-z]", translated):
                leftovers.append((herb["herb_ko"], item["ingredient"], translated))
            ingredients.append(
                {
                    "rank": item["rank"],
                    "ingredient": translated,
                    "count": item["count"],
                }
            )
        result.append(
            {
                "herb": herb["herb_ko"],
                "recipe_count": herb["recipe_count"],
                "recipe_confidence": herb["recipe_confidence"],
                "ingredients": ingredients,
            }
        )

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(result, file, ensure_ascii=False, indent=2)

    print(output_path.resolve())
    print(f"english_leftovers={len(leftovers)}")
    if leftovers:
        for item in leftovers:
            print(item)


if __name__ == "__main__":
    main()

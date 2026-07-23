from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


HERB_KO = {
    "edible_chrysanthemum": "국화",
    "japanese_plum": "매실",
    "ginkgo": "은행",
    "mugwort": "쑥",
    "jujube": "대추",
    "ginseng": "인삼",
    "dandelion": "민들레",
    "angelica": "당귀",
    "laurel": "월계수",
    "licorice": "감초",
    "burdock": "우엉",
    "lotus": "연꽃",
    "fennel": "회향",
    "arrowroot": "칡",
    "ginger": "생강",
    "cinnamon": "시나몬",
    "star_anise": "팔각",
    "mint": "박하",
    "yam": "마",
    "turmeric": "강황",
    "chinese_quince": "모과",
}


def main() -> None:
    source_dir = Path("data/recipedb")
    output_dir = Path("data/recipedb_10plus")
    output_dir.mkdir(parents=True, exist_ok=True)

    with (source_dir / "recipedb_summary.json").open(encoding="utf-8") as file:
        source_summary = json.load(file)
    with (source_dir / "recipedb_recipes.json").open(encoding="utf-8") as file:
        source_recipes = json.load(file)

    selected_labels = [
        item["herb_label"]
        for item in source_summary
        if int(item["kept_recipes"]) > 10
    ]
    selected_set = set(selected_labels)

    final_recipes = []
    for recipe in source_recipes:
        if recipe["herb_label"] not in selected_set:
            continue
        recipe["herb_ko"] = HERB_KO.get(recipe["herb_label"], recipe.get("herb_ko", ""))
        recipe["source"] = "recipedb"
        final_recipes.append(recipe)

    by_herb = defaultdict(list)
    for recipe in final_recipes:
        by_herb[recipe["herb_label"]].append(recipe)

    final_summary = []
    for item in source_summary:
        label = item["herb_label"]
        if label not in selected_set:
            continue
        count = len(by_herb[label])
        final_summary.append(
            {
                "herb_label": label,
                "herb_ko": HERB_KO.get(label, item.get("herb_ko", "")),
                "recipe_count": count,
                "recipe_confidence": round(min(1.0, count / 30), 4),
                "source": "recipedb",
            }
        )

    with (output_dir / "final_recipes.json").open("w", encoding="utf-8") as file:
        json.dump(final_recipes, file, ensure_ascii=False, indent=2)

    with (output_dir / "final_summary.json").open("w", encoding="utf-8") as file:
        json.dump(final_summary, file, ensure_ascii=False, indent=2)

    with (output_dir / "final_recipe_ingredients.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["herb_label", "herb_ko", "recipe_id", "title", "url", "ingredient"])
        for recipe in final_recipes:
            for ingredient in recipe.get("ingredients", []):
                writer.writerow([
                    recipe["herb_label"],
                    recipe["herb_ko"],
                    recipe.get("recipe_id", ""),
                    recipe.get("title", ""),
                    recipe.get("url", ""),
                    ingredient,
                ])

    ranked_counts = []
    for item in final_summary:
        label = item["herb_label"]
        counts = Counter(
            ingredient
            for recipe in by_herb[label]
            for ingredient in recipe.get("ingredients", [])
        )
        ranked_counts.append(
            {
                **item,
                "ingredients": [
                    {"rank": rank, "ingredient": ingredient, "count": count}
                    for rank, (ingredient, count) in enumerate(counts.most_common(), start=1)
                ],
            }
        )

    with (output_dir / "final_ranked_ingredients.json").open("w", encoding="utf-8") as file:
        json.dump(ranked_counts, file, ensure_ascii=False, indent=2)

    print(f"selected herbs: {len(final_summary)}")
    print(f"recipes: {len(final_recipes)}")
    print(output_dir.resolve())


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

from export_korean_ranked_counts import to_korean


def main() -> None:
    input_path = Path("data/recipedb_10plus/final_recipe_ingredients.csv")
    summary_path = Path("data/recipedb_10plus/final_summary.json")
    output_path = Path("data/recipedb_10plus/final_ranked_ingredients_ko.json")

    with summary_path.open(encoding="utf-8") as file:
        summary = json.load(file)

    summary_by_label = {item["herb_label"]: item for item in summary}
    counts_by_herb: dict[str, Counter[str]] = defaultdict(Counter)

    with input_path.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            herb_label = row["herb_label"]
            ingredient = to_korean(row["ingredient"])
            if not ingredient:
                continue
            counts_by_herb[herb_label][ingredient] += 1

    result = []
    for item in summary:
        herb_label = item["herb_label"]
        counts = counts_by_herb.get(herb_label, Counter())
        result.append(
            {
                "herb_label": herb_label,
                "herb_ko": item["herb_ko"],
                "recipe_count": item["recipe_count"],
                "recipe_confidence": item["recipe_confidence"],
                "ingredients": [
                    {
                        "rank": rank,
                        "ingredient": ingredient,
                        "count": count,
                    }
                    for rank, (ingredient, count) in enumerate(counts.most_common(), start=1)
                ],
            }
        )

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(result, file, ensure_ascii=False, indent=2)

    print(output_path.resolve())


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    input_path = Path("data/llm/llama3_1_top20_recommendations.json")
    output_path = Path("data/llm/llama3_1_top20_recommendations_compact.json")

    with input_path.open(encoding="utf-8") as file:
        data = json.load(file)

    compact = []
    for item in data["results"]:
        compact.append(
            {
                "herb": item["herb"],
                "ingredients": [
                    {
                        "rank": rec["rank"],
                        "ingredient": rec["ingredient"],
                    }
                    for rec in item["recommendations"]
                ],
            }
        )

    with output_path.open("w", encoding="utf-8") as file:
        json.dump(compact, file, ensure_ascii=False, indent=2)

    print(output_path.resolve())


if __name__ == "__main__":
    main()

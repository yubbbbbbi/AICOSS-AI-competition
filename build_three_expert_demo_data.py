import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
INPUT_DIR = ROOT / "data" / "input_top20"
OUT_PATH = ROOT / "demo" / "data" / "network-data.json"

RECIPE_PATH = INPUT_DIR / "RecipeDB_Top20.json"
FLAVOR_PATH = INPUT_DIR / "FlavorDB_Food_Pairing_Top20.json"
TCM_PATH = INPUT_DIR / "itcmdb_herb_top20.json"
TCM_BALANCE_PATH = Path("C:/Users/seong/OneDrive/문서/카카오톡 받은 파일/3_TCM_Balance_Scores.xlsx")


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def by_herb_list(records):
    return {item["herb"]: item.get("ingredients", [])[:20] for item in records}


def by_herb_dict(records):
    return {herb: ingredients[:20] for herb, ingredients in records.items()}


def rank_score(rank):
    return 21 - int(rank) if rank else 0


def load_tcm_balance():
    df = pd.read_excel(TCM_BALANCE_PATH, sheet_name="Score View")
    rows = {}
    for item in df.to_dict("records"):
        score = item.get("tcm_balance_score")
        coverage = item.get("tcm_coverage")
        status = item.get("score_status")
        rows[(item["herb"], item["candidate"])] = {
            "tcmBalanceScore": None if pd.isna(score) else float(score),
            "tcmCoverage": 0.0 if pd.isna(coverage) else float(coverage),
            "tcmScoreStatus": None if pd.isna(status) else str(status),
            "tempBalance": None if pd.isna(item.get("temp_balance")) else float(item.get("temp_balance")),
            "tasteDiversity": None if pd.isna(item.get("taste_diversity")) else float(item.get("taste_diversity")),
            "meridianCoverage": None if pd.isna(item.get("meridian_coverage")) else float(item.get("meridian_coverage")),
        }
    return rows


def main():
    recipe_records = load_json(RECIPE_PATH)
    flavor_records = load_json(FLAVOR_PATH)
    tcm_records = load_json(TCM_PATH)
    tcm_balance = load_tcm_balance()

    recipe_by_herb = by_herb_list(recipe_records)
    recipe_meta = {item["herb"]: item for item in recipe_records}
    flavor_by_herb = by_herb_dict(flavor_records)
    tcm_by_herb = by_herb_list(tcm_records)

    herbs = []
    all_ingredients = set()
    herb_names = [item["herb"] for item in recipe_records]

    for herb in herb_names:
        recipe = recipe_by_herb.get(herb, [])
        flavor = flavor_by_herb.get(herb, [])
        tcm = tcm_by_herb.get(herb, [])

        maps = {
            "recipe": {item["ingredient"]: item for item in recipe},
            "flavor": {item["ingredient"]: item for item in flavor},
            "tcm": {item["ingredient"]: item for item in tcm},
        }
        union = sorted(set(maps["recipe"]) | set(maps["flavor"]) | set(maps["tcm"]))
        all_ingredients.update(union)

        candidates = []
        for ingredient in union:
            recipe_item = maps["recipe"].get(ingredient)
            flavor_item = maps["flavor"].get(ingredient)
            tcm_item = maps["tcm"].get(ingredient)
            recipe_rank = recipe_item.get("rank") if recipe_item else None
            flavor_rank = flavor_item.get("rank") if flavor_item else None
            tcm_rank = tcm_item.get("rank") if tcm_item else None
            sources = []
            if recipe_rank:
                sources.append("RecipeDB")
            if flavor_rank:
                sources.append("FlavorDB")
            if tcm_rank:
                sources.append("iTCMDB")
            balance = tcm_balance.get((herb, ingredient), {})

            score = rank_score(recipe_rank) + rank_score(flavor_rank) + rank_score(tcm_rank)
            candidates.append(
                {
                    "ingredient": ingredient,
                    "recipeRank": recipe_rank,
                    "flavorRank": flavor_rank,
                    "tcmRank": tcm_rank,
                    "recipeCount": recipe_item.get("count") if recipe_item else None,
                    "sources": sources,
                    "sourceCount": len(sources),
                    "score": score,
                    **balance,
                }
            )

        candidates.sort(key=lambda item: (-item["sourceCount"], -item["score"], item["ingredient"]))

        recipe_set = set(maps["recipe"])
        flavor_set = set(maps["flavor"])
        tcm_set = set(maps["tcm"])
        herbs.append(
            {
                "herb": herb,
                "recipeCount": recipe_meta.get(herb, {}).get("recipe_count"),
                "recipeConfidence": recipe_meta.get(herb, {}).get("recipe_confidence"),
                "recipe": recipe,
                "flavor": flavor,
                "tcm": tcm,
                "candidates": candidates,
                "overlap": {
                    "recipeFlavor": sorted(recipe_set & flavor_set),
                    "recipeTcm": sorted(recipe_set & tcm_set),
                    "flavorTcm": sorted(flavor_set & tcm_set),
                    "allThree": sorted(recipe_set & flavor_set & tcm_set),
                    "twoOrMore": sorted(
                        ingredient
                        for ingredient in union
                        if sum(
                            [
                                ingredient in recipe_set,
                                ingredient in flavor_set,
                                ingredient in tcm_set,
                            ]
                        )
                        >= 2
                    ),
                },
            }
        )

    out = {
        "herbs": herbs,
        "allIngredients": sorted(all_ingredients),
        "meta": {
            "recipeSource": "RecipeDB Top20",
            "flavorSource": "FlavorDB Top20",
            "tcmSource": "iTCMDB Top20",
            "tcmBalanceSource": str(TCM_BALANCE_PATH),
            "scoring": "Recipe/Flavor rank scores form the base recommendation; TCM balance is used as a reranking penalty in the web demo.",
            "herbCount": len(herbs),
            "ingredientCount": len(all_ingredients),
        },
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(out["meta"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

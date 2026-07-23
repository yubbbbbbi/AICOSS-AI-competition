import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
INPUT_DIR = ROOT / "data" / "input_top20"
OUT_DIR = ROOT / "data" / "model"

RECIPE_PATH = INPUT_DIR / "RecipeDB_Top20.json"
FLAVOR_PATH = INPUT_DIR / "FlavorDB_Food_Pairing_Top20.json"
TCM_PATH = INPUT_DIR / "itcmdb_herb_top20.json"

DEFAULT_PRESETS = {
    "balanced": {"recipe": 1.0, "flavor": 1.0, "tcm": 1.0},
    "recipe_focus": {"recipe": 2.0, "flavor": 1.0, "tcm": 1.0},
    "flavor_focus": {"recipe": 1.0, "flavor": 2.0, "tcm": 1.0},
    "tcm_focus": {"recipe": 1.0, "flavor": 1.0, "tcm": 2.0},
}


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def list_by_herb(records):
    return {item["herb"]: item.get("ingredients", [])[:20] for item in records}


def dict_by_herb(records):
    return {herb: ingredients[:20] for herb, ingredients in records.items()}


def rank_to_score(rank):
    if rank is None:
        return 0.0
    return float(21 - int(rank))


def reciprocal_rank(rank, k=60):
    if rank is None:
        return 0.0
    return 1.0 / (k + int(rank))


def source_count_bonus(source_count):
    if source_count >= 3:
        return 10.0
    if source_count == 2:
        return 5.0
    return 0.0


def normalize_weights(weights):
    total = sum(max(0.0, float(value)) for value in weights.values())
    if total <= 0:
        return {"recipe": 1 / 3, "flavor": 1 / 3, "tcm": 1 / 3}
    return {key: max(0.0, float(value)) / total for key, value in weights.items()}


def build_candidates(recipe_items, flavor_items, tcm_items, weights, method):
    recipe_map = {item["ingredient"]: item for item in recipe_items}
    flavor_map = {item["ingredient"]: item for item in flavor_items}
    tcm_map = {item["ingredient"]: item for item in tcm_items}
    union = sorted(set(recipe_map) | set(flavor_map) | set(tcm_map))

    rows = []
    for ingredient in union:
        recipe_rank = recipe_map.get(ingredient, {}).get("rank")
        flavor_rank = flavor_map.get(ingredient, {}).get("rank")
        tcm_rank = tcm_map.get(ingredient, {}).get("rank")
        recipe_count = recipe_map.get(ingredient, {}).get("count")

        if method == "rrf":
            recipe_score = reciprocal_rank(recipe_rank)
            flavor_score = reciprocal_rank(flavor_rank)
            tcm_score = reciprocal_rank(tcm_rank)
            consensus_bonus = source_count_bonus(sum(rank is not None for rank in [recipe_rank, flavor_rank, tcm_rank])) / 1000.0
        else:
            recipe_score = rank_to_score(recipe_rank)
            flavor_score = rank_to_score(flavor_rank)
            tcm_score = rank_to_score(tcm_rank)
            consensus_bonus = source_count_bonus(sum(rank is not None for rank in [recipe_rank, flavor_rank, tcm_rank]))

        source_support = {}
        if recipe_rank is not None:
            source_support["RecipeDB"] = {
                "rank": recipe_rank,
                "rank_score": rank_to_score(recipe_rank),
                "count": recipe_count,
            }
        if flavor_rank is not None:
            source_support["FlavorDB"] = {
                "rank": flavor_rank,
                "rank_score": rank_to_score(flavor_rank),
            }
        if tcm_rank is not None:
            source_support["iTCMDB"] = {
                "rank": tcm_rank,
                "rank_score": rank_to_score(tcm_rank),
            }

        weighted_score = (
            weights["recipe"] * recipe_score
            + weights["flavor"] * flavor_score
            + weights["tcm"] * tcm_score
        )
        final_score = weighted_score + consensus_bonus

        rows.append(
            {
                "ingredient": ingredient,
                "final_score": round(final_score, 6),
                "weighted_rank_score": round(weighted_score, 6),
                "consensus_bonus": round(consensus_bonus, 6),
                "source_count": len(source_support),
                "source_support": source_support,
            }
        )

    rows.sort(
        key=lambda item: (
            -item["final_score"],
            -item["source_count"],
            item["ingredient"],
        )
    )
    for rank, item in enumerate(rows, start=1):
        item["rank"] = rank
    return rows


def run_model(method="borda", presets=None):
    recipe_records = load_json(RECIPE_PATH)
    flavor_records = load_json(FLAVOR_PATH)
    tcm_records = load_json(TCM_PATH)

    recipe_by_herb = list_by_herb(recipe_records)
    flavor_by_herb = dict_by_herb(flavor_records)
    tcm_by_herb = list_by_herb(tcm_records)

    presets = presets or DEFAULT_PRESETS
    outputs = {
        "metadata": {
            "model": "three_expert_weighted_rank_fusion",
            "method": method,
            "description": "RecipeDB, FlavorDB, iTCMDB Top20 rankings are fused into explainable herb-ingredient Top20 recommendations.",
            "sources": {
                "recipe": str(RECIPE_PATH),
                "flavor": str(FLAVOR_PATH),
                "tcm": str(TCM_PATH),
            },
            "scoring": {
                "borda": "rank_score = 21 - rank; final_score = weighted sum + consensus bonus",
                "rrf": "rank_score = 1 / (60 + rank); final_score = weighted sum + scaled consensus bonus",
                "consensus_bonus_borda": {"3_sources": 10, "2_sources": 5, "1_source": 0},
            },
        },
        "presets": {},
    }

    herb_names = [item["herb"] for item in recipe_records]
    for preset_name, raw_weights in presets.items():
        weights = normalize_weights(raw_weights)
        herb_outputs = []
        for herb in herb_names:
            candidates = build_candidates(
                recipe_by_herb.get(herb, []),
                flavor_by_herb.get(herb, []),
                tcm_by_herb.get(herb, []),
                weights,
                method,
            )
            herb_outputs.append(
                {
                    "herb": herb,
                    "weights": weights,
                    "recommendations": candidates[:20],
                    "all_candidates": candidates,
                }
            )
        outputs["presets"][preset_name] = herb_outputs
    return outputs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--method", choices=["borda", "rrf"], default="borda")
    parser.add_argument("--recipe-weight", type=float, default=None)
    parser.add_argument("--flavor-weight", type=float, default=None)
    parser.add_argument("--tcm-weight", type=float, default=None)
    args = parser.parse_args()

    presets = None
    if args.recipe_weight is not None or args.flavor_weight is not None or args.tcm_weight is not None:
        presets = {
            "custom": {
                "recipe": args.recipe_weight if args.recipe_weight is not None else 1.0,
                "flavor": args.flavor_weight if args.flavor_weight is not None else 1.0,
                "tcm": args.tcm_weight if args.tcm_weight is not None else 1.0,
            }
        }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = run_model(method=args.method, presets=presets)
    out_path = OUT_DIR / f"three_expert_rank_fusion_{args.method}_top20.json"
    out_path.write_text(json.dumps(outputs, ensure_ascii=False, indent=2), encoding="utf-8")

    compact = {
        "metadata": outputs["metadata"],
        "presets": {
            preset: [
                {
                    "herb": item["herb"],
                    "weights": item["weights"],
                    "recommendations": [
                        {
                            "rank": rec["rank"],
                            "ingredient": rec["ingredient"],
                            "final_score": rec["final_score"],
                            "source_count": rec["source_count"],
                            "source_support": rec["source_support"],
                        }
                        for rec in item["recommendations"]
                    ],
                }
                for item in herbs
            ]
            for preset, herbs in outputs["presets"].items()
        },
    }
    compact_path = OUT_DIR / f"three_expert_rank_fusion_{args.method}_top20_compact.json"
    compact_path.write_text(json.dumps(compact, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"wrote {out_path}")
    print(f"wrote {compact_path}")


if __name__ == "__main__":
    main()

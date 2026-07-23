from __future__ import annotations

import argparse
import csv
import html
import json
import re
import time
from collections import Counter
from dataclasses import asdict, dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from http.client import RemoteDisconnected
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen


BASE_URL = "https://cosylab.iiitd.edu.in"
SEARCH_URL = f"{BASE_URL}/recipedb/search_recipe"


CANDIDATES = [
    {
        "ko": "\uad6d\ud654",
        "label": "edible_chrysanthemum",
        "queries": ["Chrysanthemum", "Edible Chrysanthemum"],
        "target_terms": ["chrysanthemum", "edible chrysanthemum"],
        "recipedb_known_count": 0,
    },
    {
        "ko": "\ub9e4\uc2e4",
        "label": "japanese_plum",
        "queries": ["Japanese Apricot", "Ume", "Prunus Mume"],
        "target_terms": ["japanese apricot", "ume", "ume plum", "umeboshi", "prunus mume"],
        "recipedb_known_count": 0,
    },
    {
        "ko": "\uc740\ud589",
        "label": "ginkgo",
        "queries": ["Ginkgo"],
        "target_terms": ["ginkgo", "ginkgo nut"],
        "recipedb_known_count": 2,
    },
    {
        "ko": "\uc465",
        "label": "mugwort",
        "queries": ["Mugwort", "Artemisia"],
        "target_terms": ["mugwort", "artemisia"],
        "recipedb_known_count": 2,
    },
    {
        "ko": "\ub300\ucd94",
        "label": "jujube",
        "queries": ["Jujube", "Date"],
        "target_terms": ["jujube", "date", "red date", "korean date"],
        "recipedb_known_count": 2,
    },
    {
        "ko": "\uc778\uc0bc",
        "label": "ginseng",
        "queries": ["Ginseng"],
        "target_terms": ["ginseng", "ginseng root", "american ginseng"],
        "recipedb_known_count": 7,
    },
    {
        "ko": "\ubbfc\ub4e4\ub808",
        "label": "dandelion",
        "queries": ["Dandelion"],
        "target_terms": ["dandelion", "dandelion root", "dandelion greens"],
        "recipedb_known_count": 14,
    },
    {
        "ko": "\ub2f9\uadc0",
        "label": "angelica",
        "queries": ["Angelica"],
        "target_terms": ["angelica"],
        "recipedb_known_count": 14,
    },
    {
        "ko": "\uc6d4\uacc4\uc218",
        "label": "laurel",
        "queries": ["Laurel", "Bay Leaf"],
        "target_terms": ["laurel", "bay leaf"],
        "recipedb_known_count": 15,
    },
    {
        "ko": "\uac10\ucd08",
        "label": "licorice",
        "queries": ["Licorice"],
        "target_terms": ["licorice", "licorice root"],
        "recipedb_known_count": 16,
    },
    {
        "ko": "\uc6b0\uc5c9",
        "label": "burdock",
        "queries": ["Burdock", "Burdock Root"],
        "target_terms": ["burdock", "burdock root"],
        "recipedb_known_count": 20,
    },
    {
        "ko": "\uc5f0\uaf43",
        "label": "lotus",
        "queries": ["Lotus", "Lotus Root", "Lotus Seed"],
        "target_terms": ["lotus", "lotus root", "lotus seed"],
        "recipedb_known_count": 20,
    },
    {
        "ko": "\ud68c\ud5a5",
        "label": "fennel",
        "queries": ["Fennel"],
        "target_terms": ["fennel", "fennel seed", "fennel seeds"],
        "recipedb_known_count": None,
    },
    {
        "ko": "\uce61",
        "label": "arrowroot",
        "queries": ["Arrowroot"],
        "target_terms": ["arrowroot"],
        "recipedb_known_count": None,
    },
    {
        "ko": "\uc0dd\uac15",
        "label": "ginger",
        "queries": ["Ginger"],
        "target_terms": ["ginger", "ginger ale", "ginger beer"],
        "recipedb_known_count": None,
    },
    {
        "ko": "\uc2dc\ub098\ubaac",
        "label": "cinnamon",
        "queries": ["Cinnamon"],
        "target_terms": ["cinnamon", "cinnamon sugar"],
        "recipedb_known_count": None,
    },
    {
        "ko": "\ud314\uac01",
        "label": "star_anise",
        "queries": ["Star Anise", "Anise"],
        "target_terms": ["star anise"],
        "recipedb_known_count": None,
    },
    {
        "ko": "\ubc15\ud558",
        "label": "mint",
        "queries": ["Mint", "Peppermint"],
        "target_terms": ["mint", "peppermint", "mint leaf", "mint leaves", "fresh mint"],
        "recipedb_known_count": None,
    },
    {
        "ko": "\ub9c8",
        "label": "yam",
        "queries": ["Yam"],
        "target_terms": ["yam", "ube"],
        "recipedb_known_count": None,
    },
    {
        "ko": "\uac15\ud669",
        "label": "turmeric",
        "queries": ["Turmeric"],
        "target_terms": ["turmeric"],
        "recipedb_known_count": None,
    },
    {
        "ko": "\ubaa8\uacfc",
        "label": "chinese_quince",
        "queries": ["Chinese Quince", "Quince"],
        "target_terms": ["chinese quince", "quince"],
        "recipedb_known_count": None,
    },
]

CANDIDATE_BY_LABEL = {str(candidate["label"]): candidate for candidate in CANDIDATES}

DROP_INGREDIENTS = {
    "water",
    "ice",
    "salt",
    "black pepper",
    "pepper",
    "cooking spray",
}

ALIASES = {
    "caster sugar": "sugar",
    "granulated sugar": "sugar",
    "brown sugar": "sugar",
    "white sugar": "sugar",
    "powdered sugar": "sugar",
    "confectioner sugar": "sugar",
    "confectioners sugar": "sugar",
    "icing sugar": "sugar",
    "lemon juice": "lemon",
    "lemon zest": "lemon",
    "lime juice": "lime",
    "lime zest": "lime",
    "fresh mint": "mint",
    "peppermint": "mint",
    "ground cinnamon": "cinnamon",
    "cinnamon stick": "cinnamon",
    "cinnamon sticks": "cinnamon",
    "ground ginger": "ginger",
    "fresh ginger": "ginger",
    "gingerroot": "ginger",
    "ginger root": "ginger",
    "star anise pod": "star anise",
    "star anise pods": "star anise",
    "whole clove": "clove",
    "whole cloves": "clove",
    "ground clove": "clove",
    "ground cloves": "clove",
}


def log(message: str) -> None:
    print(message.encode("cp949", errors="replace").decode("cp949"))


@dataclass
class RecipeRecord:
    herb_label: str
    herb_ko: str
    search_query: str
    recipe_id: str
    title: str
    url: str
    ingredients: list[str]


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if text:
            self.parts.append(text)

    def text(self) -> str:
        return " ".join(self.parts)


def fetch(url: str, data: bytes | None = None, delay: float = 0.2, retries: int = 2) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
    }
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = Request(url, data=data, headers=headers, method="POST" if data is not None else "GET")
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        time.sleep(delay * (attempt + 1))
        try:
            with urlopen(req, timeout=30) as res:
                return res.read().decode(res.headers.get_content_charset() or "utf-8", errors="replace")
        except (HTTPError, URLError, TimeoutError, RemoteDisconnected) as exc:
            last_error = exc
    assert last_error is not None
    raise last_error


def search_recipes(query: str, page: int, delay: float) -> list[tuple[str, str]]:
    payload = urlencode(
        {
            "autocomplete_ingredient": query,
            "autocomplete_noningredient": "",
            "page": str(page),
        }
    ).encode()
    raw_html = fetch(SEARCH_URL, data=payload, delay=delay)
    hits: list[tuple[str, str]] = []
    for match in re.finditer(
        r"<a\s+href=['\"](?P<href>/recipedb/search_recipeInfo/(?P<id>\d+))['\"][^>]*>(?P<title>.*?)</td>",
        raw_html,
        flags=re.I | re.S,
    ):
        title_parser = TextExtractor()
        title_parser.feed(match.group("title"))
        title = html.unescape(re.sub(r"\s+", " ", title_parser.text())).strip()
        hits.append((match.group("id"), title))
    return hits


def normalize_ingredient(value: str) -> str | None:
    name = html.unescape(value).strip().lower()
    name = re.sub(r"\([^)]*\)", " ", name)
    name = re.sub(r"[^a-z0-9\s-]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        return None
    name = ALIASES.get(name, name)
    if name in DROP_INGREDIENTS:
        return None
    return name


def normalize_target_terms(values: Iterable[str]) -> set[str]:
    terms: set[str] = set()
    for value in values:
        normalized = normalize_ingredient(str(value))
        if normalized:
            terms.add(normalized)
    return terms


def ingredient_matches_target(name: str, target_terms: set[str]) -> bool:
    return name in target_terms


def detail_ingredients(recipe_id: str, delay: float) -> list[str]:
    raw_html = fetch(f"{BASE_URL}/recipedb/search_recipeInfo/{recipe_id}", delay=delay)
    start = raw_html.find('id="ingredient_nutri"')
    if start == -1:
        return []
    end = raw_html.find("</table>", start)
    block = raw_html[start:end]
    names: list[str] = []
    for match in re.finditer(
        r'<a\s+href=["\']/recipedb/search_ingre/[^"\']+["\'][^>]*>(.*?)</a>',
        block,
        flags=re.I | re.S,
    ):
        parser = TextExtractor()
        parser.feed(match.group(1))
        normalized = normalize_ingredient(parser.text())
        if normalized:
            names.append(normalized)
    return dedupe(names)


def dedupe(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            out.append(value)
    return out


def scrape_candidate(
    candidate: dict[str, object],
    target: int,
    max_pages: int,
    delay: float,
    max_workers: int,
) -> list[RecipeRecord]:
    label = str(candidate["label"])
    ko = str(candidate["ko"])
    queries = list(candidate["queries"])  # type: ignore[arg-type]
    target_terms = normalize_target_terms(candidate.get("target_terms", queries))  # type: ignore[arg-type]
    seen_ids: set[str] = set()
    candidates: list[tuple[str, str, str]] = []

    for query in queries:
        for page in range(1, max_pages + 1):
            if len(candidates) >= target * 3:
                break
            log(f"\n[{label}] search={query!r} page={page}")
            try:
                hits = search_recipes(str(query), page, delay)
            except (HTTPError, URLError, TimeoutError, RemoteDisconnected) as exc:
                log(f"  search skip: {exc}")
                continue
            log(f"  hits: {len(hits)}")
            if not hits:
                break
            for recipe_id, title in hits:
                if recipe_id in seen_ids:
                    continue
                seen_ids.add(recipe_id)
                candidates.append((str(query), recipe_id, title))
                if len(candidates) >= target * 3:
                    break

    def build_record(item: tuple[str, str, str]) -> RecipeRecord | None:
        query, recipe_id, title = item
        try:
            ingredients = detail_ingredients(recipe_id, delay)
        except (HTTPError, URLError, TimeoutError, RemoteDisconnected) as exc:
            log(f"  detail skip {recipe_id}: {exc}")
            return None
        has_target = any(ingredient_matches_target(name, target_terms) for name in ingredients)
        if not has_target:
            return None
        ingredients = [name for name in ingredients if not ingredient_matches_target(name, target_terms)]
        if not ingredients:
            return None
        return RecipeRecord(
            herb_label=label,
            herb_ko=ko,
            search_query=query,
            recipe_id=recipe_id,
            title=title,
            url=f"{BASE_URL}/recipedb/search_recipeInfo/{recipe_id}",
            ingredients=ingredients,
        )

    records: list[RecipeRecord] = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_item = {executor.submit(build_record, item): item for item in candidates}
        for future in as_completed(future_to_item):
            record = future.result()
            if not record:
                continue
            records.append(record)
            log(f"  keep {len(records)}/{target}: {record.title} -> {', '.join(record.ingredients[:8])}")
            if len(records) >= target:
                break
    return records


def write_outputs(records_by_herb: dict[str, list[RecipeRecord]], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    all_records = [record for records in records_by_herb.values() for record in records]

    with (output_dir / "recipedb_recipes.json").open("w", encoding="utf-8") as file:
        json.dump([asdict(record) for record in all_records], file, ensure_ascii=False, indent=2)

    with (output_dir / "recipedb_recipe_ingredients.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["herb_label", "herb_ko", "search_query", "recipe_id", "title", "url", "ingredient"])
        for record in all_records:
            for ingredient in record.ingredients:
                writer.writerow([
                    record.herb_label,
                    record.herb_ko,
                    record.search_query,
                    record.recipe_id,
                    record.title,
                    record.url,
                    ingredient,
                ])

    with (output_dir / "recipedb_ingredient_counts.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["herb_label", "herb_ko", "ingredient", "count", "recipe_share"])
        for label, records in records_by_herb.items():
            ko = records[0].herb_ko if records else ""
            counts = Counter(item for record in records for item in record.ingredients)
            recipe_count = max(len(records), 1)
            for ingredient, count in counts.most_common():
                writer.writerow([label, ko, ingredient, count, round(count / recipe_count, 4)])

    summary = []
    for candidate_item in CANDIDATES:
        label = str(candidate_item["label"])
        records = records_by_herb.get(label, [])
        candidate = CANDIDATE_BY_LABEL.get(label, {})
        ko = records[0].herb_ko if records else str(candidate.get("ko", ""))
        known_count = candidate.get("recipedb_known_count")
        summary.append(
            {
                "herb_label": label,
                "herb_ko": ko,
                "recipedb_known_count": known_count,
                "kept_recipes": len(records),
                "recipe_confidence": round(min(1.0, len(records) / 30), 4),
            }
        )
    with (output_dir / "recipedb_summary.json").open("w", encoding="utf-8") as file:
        json.dump(summary, file, ensure_ascii=False, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape RecipeDB ingredient co-occurrence for herb candidates.")
    parser.add_argument("--target-per-herb", type=int, default=30)
    parser.add_argument("--max-pages", type=int, default=3)
    parser.add_argument("--delay", type=float, default=0.03)
    parser.add_argument("--max-workers", type=int, default=10)
    parser.add_argument("--output-dir", default="data/recipedb")
    parser.add_argument("--only", help="Comma-separated herb labels to scrape, e.g. ginger,cinnamon")
    args = parser.parse_args()

    selected = CANDIDATES
    if args.only:
        wanted = {item.strip() for item in args.only.split(",") if item.strip()}
        selected = [candidate for candidate in CANDIDATES if candidate["label"] in wanted]

    records_by_herb: dict[str, list[RecipeRecord]] = {}
    for candidate in selected:
        label = str(candidate["label"])
        log(f"\n===== {label} / {candidate['ko']} =====")
        records_by_herb[label] = scrape_candidate(
            candidate,
            args.target_per_herb,
            args.max_pages,
            args.delay,
            args.max_workers,
        )
        write_outputs(records_by_herb, Path(args.output_dir))
        log(f"  partial saved after {label}")

    write_outputs(records_by_herb, Path(args.output_dir))
    log(f"\nsaved: {Path(args.output_dir).resolve()}")


if __name__ == "__main__":
    main()

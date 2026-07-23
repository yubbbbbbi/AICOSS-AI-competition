from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


HERBS = [
    "Jujube",
    "Angelica",
    "Laurel",
    "Burdock",
    "Lotus",
    "Fennel",
    "Arrowroot",
    "Ginger",
    "Cinnamon",
    "Star Anise",
    "Mint",
    "Yam",
    "Turmeric",
    "Chinese Quince",
]


def build_prompt(herb: str) -> str:
    return (
        f"Please recommend the top-20 ingredients that pair well with [{herb}]. "
        "List only the number and ingredient name, omitting explanations."
    )


def parse_numbered_list(text: str) -> list[dict[str, object]]:
    recommendations = []
    seen = set()
    for raw_line in text.splitlines():
        line = raw_line.strip()
        match = re.match(r"^\s*(\d+)[\.\)]\s*(.+?)\s*$", line)
        if not match:
            continue
        ingredient = match.group(2).strip()
        ingredient = re.sub(r"^[\"'`]+|[\"'`]+$", "", ingredient).strip()
        ingredient = re.sub(r"\s+[-:]\s+.*$", "", ingredient).strip()
        if not ingredient or ingredient.lower() in seen:
            continue
        seen.add(ingredient.lower())
        recommendations.append({"rank": len(recommendations) + 1, "ingredient": ingredient})
        if len(recommendations) >= 20:
            break
    if not recommendations:
        # Fallback for comma-separated or bullet-ish outputs.
        pieces = re.split(r",|\n", text)
        for piece in pieces:
            ingredient = re.sub(r"^\s*[-*]?\s*\d*[\.\)]?\s*", "", piece).strip()
            if not ingredient or ingredient.lower() in seen:
                continue
            seen.add(ingredient.lower())
            recommendations.append({"rank": len(recommendations) + 1, "ingredient": ingredient})
            if len(recommendations) >= 20:
                break
    return recommendations


def call_ollama(herb: str, model: str, endpoint: str, temperature: float, timeout: int) -> dict:
    payload = {
        "model": model,
        "prompt": build_prompt(herb),
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_ctx": 4096,
        },
    }
    request = Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.time()
    with urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
    elapsed = round(time.time() - started, 3)
    data = json.loads(raw)
    response_text = data.get("response", "")
    return {
        "herb": herb,
        "prompt": build_prompt(herb),
        "recommendations": parse_numbered_list(response_text),
        "raw_response": response_text,
        "_meta": {
            "model": model,
            "temperature": temperature,
            "elapsed_seconds": elapsed,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch independent Ollama prompts for herb top-20 ingredient recommendations.")
    parser.add_argument("--model", default="llama3.1")
    parser.add_argument("--endpoint", default="http://localhost:11434/api/generate")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--timeout", type=int, default=240)
    parser.add_argument("--output", default="data/llm/llama3_1_top20_recommendations.json")
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    results = []
    failures = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(call_ollama, herb, args.model, args.endpoint, args.temperature, args.timeout): herb
            for herb in HERBS
        }
        for future in as_completed(futures):
            herb = futures[future]
            try:
                result = future.result()
                results.append(result)
                print(f"OK {herb}: {len(result['recommendations'])} items")
            except (URLError, TimeoutError, json.JSONDecodeError, Exception) as exc:
                failures.append({"herb": herb, "error": repr(exc)})
                print(f"FAIL {herb}: {exc!r}")

    order = {herb: idx for idx, herb in enumerate(HERBS)}
    results.sort(key=lambda item: order.get(item["herb"], 999))

    payload = {
        "method": "Independent Ollama calls using the user's exact top-20 prompt; no RAG and no shared conversation history.",
        "model": args.model,
        "temperature": args.temperature,
        "workers": args.workers,
        "results": results,
        "failures": failures,
    }
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
    print(f"saved: {output_path.resolve()}")


if __name__ == "__main__":
    main()

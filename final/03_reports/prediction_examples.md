# 추론 예시 — 실제 입력 → 결과

`02_model/predict.py`에 실제 herb를 넣었을 때의 출력입니다.
모델은 **B5 ConcatMLP**(최종 채택), 점수는 3개 LLM 예측 확률의 평균입니다.

**컬럼 의미**
- `score`: Claude/Llama/GPT 예측 확률의 평균 (0~1)
- `cook/flavor/prop`: O = 해당 축 활성(mask=1), - = 부재
- `axes`: 활성 축 개수 (3=완비, 0=근거 없음)

---

## 예시 1. 대추 상위 15

```
python predict.py --herb 대추 --top 15
```

```
rank candidate    score  cook flavor prop axes
   1 시나몬         0.95    O     O    O    3
   2 넛맥          0.93    O     O    O    3
   3 생강          0.92    O     O    O    3
   4 카이엔페퍼       0.91    O     O    O    3
   5 설탕          0.89    O     O    -    2
   6 닭고기         0.87    O     O    O    3
   7 간장          0.87    O     O    O    3
   8 양파          0.87    O     O    O    3
   9 꿀           0.84    O     O    O    3
  10 마늘          0.83    O     O    O    3
  11 레몬          0.83    O     O    O    3
  12 코코넛         0.82    O     O    O    3
  13 올스파이스       0.80    O     O    -    2
  14 찹쌀          0.80    O     O    O    3
  15 배           0.79    O     O    O    3
```

시나몬·넛맥·생강·꿀·찹쌀 — 대추차·약과·약선 재료가 상위입니다. 실제 대추 조합과 일치합니다.

---

## 예시 2. 생강 상위 15

```
python predict.py --herb 생강 --top 15
```

```
rank candidate    score  cook flavor prop axes
   1 시나몬         0.95    O     O    O    3
   2 넛맥          0.93    O     O    O    3
   3 카이엔페퍼       0.92    O     O    O    3
   4 고수          0.91    O     O    O    3
   5 마늘          0.89    O     O    O    3
   6 바질          0.88    O     O    O    3
   7 레몬          0.87    O     O    O    3
   8 밀가루         0.84    O     O    O    3
   9 팔각          0.84    O     O    O    3
  10 대파          0.83    -     O    O    2      ← 조리 축 부재(-)
  11 양파          0.82    O     O    O    3
  ...
```

10위 대파는 `cook=-`입니다 — RecipeDB 430에 (생강, 대파) 동시등장이 없어 조리 축이 비었지만,
향미·전통 축이 살아 추천됩니다. **마스크가 "정보 없음"을 정직하게 표시**하는 예입니다.

---

## 예시 3. 월계수 상위 12 — 전통 축 부재 대조군 ★

```
python predict.py --herb 월계수 --top 12
```

```
rank candidate    score  cook flavor prop axes
   1 양파          0.94    O     O    -    2
   2 파프리카        0.79    O     O    -    2
   3 올리브오일       0.79    O     O    -    2
   4 베이컨         0.77    O     O    -    2
   5 파슬리         0.77    O     O    -    2
   6 식용유         0.76    O     O    -    2
   7 타임          0.76    O     O    -    2
   8 딜           0.73    O     O    -    2
   9 로즈마리        0.73    O     O    -    2
  10 바질          0.71    O     O    -    2
  11 마조람         0.69    O     O    -    2
  12 생강          0.69    O     O    -    2
```

**전 후보의 prop이 `-`(부재)입니다.** 월계수는 본초(TCM-MKG)에 없어 성미귀경이 없기 때문입니다.
모델이 이를 정확히 반영해, 월계수는 조리+향미 두 축으로만 추천합니다. 서양 허브(타임·로즈마리·
딜)와 양파·베이컨이 상위인 것도 월계수의 실제 서양 요리 용법과 맞습니다.

---

## 예시 4. 우엉 상위 12 — 동아시아 재료

```
python predict.py --herb 우엉 --top 12
```

```
rank candidate    score  cook flavor prop axes
   1 간장          0.92    O     O    O    3
   2 생강          0.91    O     O    O    3
   3 참기름         0.90    O     O    O    3
   4 미림          0.88    O     O    -    2
   5 청주          0.88    O     O    -    2
   6 마늘          0.87    O     O    O    3
   7 양파          0.86    O     O    O    3
   8 바질          0.82    O     O    O    3
   9 다시마         0.81    O     O    O    3
  10 다시          0.81    O     O    -    2
  11 닭고기         0.81    O     O    O    3
  12 두부          0.79    O     O    O    3
```

간장·참기름·미림·다시마·두부 — 우엉조림(긴피라) 재료가 정확히 상위입니다. 동아시아 재료도
잘 작동합니다.

---

## 예시 5. 단일 쌍 조회

### (대추, 생강) — 좋은 조합

```
python predict.py --herb 대추 --candidate 생강
```

```
rank candidate    score  cook flavor prop axes
   1 생강          0.92    O     O    O    3
```

세 축 모두 활성, 점수 0.92. 대추+생강은 전형적 조합입니다.

### (대추, 안초비) — 근거 없음 ★

```
python predict.py --herb 대추 --candidate 안초비
```

```
rank candidate    score  cook flavor prop axes
   — 안초비         0.22    -     -    -    0  [근거 없음]
```

**세 축 모두 부재(axes=0)**입니다. RecipeDB에도, FlavorGraph에도, 성미귀경에도 (대추, 안초비)
정보가 없습니다. 점수 0.22로 낮고 `[근거 없음]` 태그가 붙습니다. **"어떤 근거로도 접근 불가한
페어링"을 시스템이 명시적으로 구분**하는 예입니다.

---

## 예시 6. JSON 출력 (RAG 연동용)

```
python predict.py --herb 대추 --candidate 시나몬 --json
```

```json
{
  "herb": "대추",
  "model": "b5_final",
  "recommendations": [
    {
      "candidate": "시나몬",
      "score": 0.955,
      "llm_scores": { "claude": 0.958, "llama": 0.962, "gpt": 0.944 },
      "axes": { "cook": true, "flavor": true, "prop": true },
      "n_axes": 3,
      "features": {
        "cook_pmi": 0.226, "fg_cosine": 0.174,
        "qi_diff": 1.0, "wei_jac": 0.5, "gui_jac": 0.4
      }
    }
  ]
}
```

- `llm_scores`: 3개 LLM 예측을 개별 제공 (합의도 확인용)
- `features`: 점수의 근거가 된 축별 값 (설명 생성용)
- RAG 파트에서 이 JSON을 받아 "왜 이 조합인가"를 설명에 쓸 수 있습니다.

---

## 요약 — 이 예시들이 보여주는 것

| 상황 | 예시 | 시스템 동작 |
|---|---|---|
| 3축 완비 좋은 조합 | 대추+시나몬(0.95) | 높은 점수, axes=3 |
| 일부 축 부재 | 생강+대파 (cook=-) | 남은 축으로 추천, 마스크 표시 |
| 전통 축 통째 부재 | 월계수 전체 | prop=- (본초 미수재) 정직 반영 |
| 근거 전무 | 대추+안초비 | axes=0, [근거 없음] 태그 |
| 동아시아 재료 | 우엉→간장·다시마 | 조림 재료 정확 포착 |

**핵심**: 점수만 내는 게 아니라 **"어느 근거로 이 점수가 나왔는가"(axes/features)를 함께
제공**합니다. 근거 없는 조합(axes=0)을 억지로 추천하지 않고 명시적으로 구분하는 것이,
availability mask를 설계한 이유입니다.

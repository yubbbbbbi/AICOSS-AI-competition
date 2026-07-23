# AICOSS Herb Pairing Demo

약재 기반 식재료 페어링을 설명 가능하게 보여주는 정적 웹 데모입니다.

## Demo

- Entry: `index.html`
- App: `demo/index.html`
- Data: `demo/data/*.json`

로컬 실행:

```powershell
cd C:\AICOSS\demo
python -m http.server 8765
```

브라우저에서 `http://127.0.0.1:8765/` 접속.

## Recommendation Logic

현재 시연 버전은 임베딩 학습 모델이 아니라, 세 지식원의 결과를 점수화해 실시간으로 재정렬하는 MVP입니다.

```text
RecipeScore = 21 - RecipeDB rank
FlavorScore = 21 - FlavorDB rank

BaseScore = alpha * RecipeScore + (1 - alpha) * FlavorScore
한방 불균형 감점 = lambda * (1 - 한방 균형 점수) * coverage

FinalScore = BaseScore - 한방 불균형 감점
```

한방 균형 점수는 온도, 맛, 귀경 세 축을 삼각형 UI로 조절합니다.

```text
한방 균형 점수
= w_temp * temp_balance
+ w_taste * taste_diversity
+ w_meridian * meridian_coverage
```

결측된 한방 속성은 coverage로 반영해 정보가 없는 조합이 과도하게 감점되지 않도록 했습니다.

## Data Sources

- RecipeDB: 실제 레시피 동시 등장 기반 Top20
- FlavorDB: 향미/분자 기반 Top20
- 한방 균형 기준: 온도, 맛, 귀경 속성 기반 균형 점수
- RAG Reference: 실제 카페 메뉴 및 전세계 레시피 레퍼런스

## Presentation Flow

1. 약재 선택
2. Recipe 중심 또는 Flavor 중심 비율 조절
3. 온도/맛/귀경 삼각형 가중치 조절
5. Fusion Top20, 근거 네트워크, 실제 메뉴/레시피 레퍼런스 확인

## Regenerate Demo Data

```powershell
cd C:\AICOSS
python build_three_expert_demo_data.py
python scripts\build_rag_reference_demo_data.py
```

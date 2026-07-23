# 실험 1 — 최종 산출물

한약재(herb) × 재료(candidate) 페어링 추천의 소스 가중치 학습 결과입니다.
**조리 축 = RecipeDB 430** 기준(RecipeNLG 미사용). 폴더는 용도별로 나눴습니다.

```
final/
├── 01_dataset/   학습 데이터
├── 02_model/     최종 모델 + 추론 스크립트 (배포에 필요한 전부)
├── 03_reports/   사람이 읽는 리포트
├── 04_inputs/    데이터셋 재생성용 원천
└── 05_metrics/   리포트 근거 원시 수치 (기계용)
```

---

## 01_dataset — 학습 데이터

| 파일 | 내용 |
|---|---|
| `exp1_dataset.csv` | **메인 데이터셋** 3,696행 × 23컬럼 (14 herbs × 264 candidates) |
| `prop_only_pairs.csv` | 전통 축만 활성인 377쌍 (약선 조합 발굴용) |

### exp1_dataset.csv 스키마

`herb, candidate` + feature 9 + mask 6 + miss 3 + label 3.

| 그룹 | 컬럼 |
|---|---|
| 조리 | cook_count, cook_rank_inv, cook_pmi |
| 향미 | fg_cosine, fdb_rank_inv |
| 전통 | qi_diff, qi_B, wei_jac, gui_jac |
| 마스크 | mask_cook, mask_flavor, mask_qi, mask_wei, mask_gui, mask_prop |
| 결측 | miss_qi, miss_wei, miss_gui |
| 라벨 | label_claude, label_llama, label_gpt |

**학습 필수 규칙**
- 세 축 모두 마스크된 1,373쌍은 학습 **제외** → 학습 대상 2,323쌍
- positive rate 18.9%, **pos_weight(LLM별)**: Claude 8.22 · Llama 8.72 · GPT 7.60
- 마스크 필수 사용 (mask=0 행 feature는 0 → "값 0"과 "정보 없음" 구분용)
- 정규화는 학습 시점 train fold 통계로만 (여기 CSV는 원값)
- 월계수는 mask_prop 전부 0 (본초 미수재)

---

## 02_model — 최종 모델 + 추론 ★

배포·추론에 필요한 것만 모았습니다. 이 폴더에서 실행하면 01_dataset을 자동 참조합니다.

| 파일 | 내용 |
|---|---|
| `b5_final.pt` | **최종 모델** ConcatMLP (12→48→24→3), B5 채택 |
| `b5_config.json` | feature 순서·정규화 규칙·하이퍼파라미터 |
| `scaler.pkl` | 정규화 통계 (전체 데이터 mean/std, 추론 재현 필수) |
| `moe_final.pt` | MoE 가중치 (게이트 분석 재현용, 참고) |
| `predict.py` | 추론 스크립트 (B5, **기본**) |
| `predict_moe.py` | MoE 추론 (게이트 표시, 참고용) |

### 추론 사용법

```bash
cd final/02_model
python predict.py --herb 대추 --top 20          # 상위 20
python predict.py --herb 대추 --candidate 생강    # 단일 쌍
python predict.py --herb 대추 --sort axes        # 축 수 우선 정렬
python predict.py --herb 대추 --json             # RAG 연동용 JSON
```

**모델 선택 근거**: B5(0.362) > MoE(0.343), p=0.0013으로 유의. MoE 게이트가 조리 축으로
붕괴해 성능·해석 모두 열세. 상세는 03_reports/exp1_final_report.md.

---

## 03_reports — 리포트 (사람용)

| 파일 | 내용 |
|---|---|
| `exp1_coverage.md` | 데이터셋 커버리지·마스크 통계 (단계 0) |
| `train_results.md` | 학습 결과 + 게이트 프로파일 |
| `exp1_final_report.md` | **최종 분석** — t-test·증분·조리부재 영역·전통 단독 |
| `prediction_examples.md` | **실제 입력 → 결과 예시** (B5, 대추·월계수·근거없음 등 6종) |
| `prediction_examples_moe.md` | MoE 추론 예시 + 게이트 + B5 비교 (참고) |
| `moe_all_herbs.md` | MoE 14개 herb 전체 추천 (게이트 포함) |

### 핵심 결론 (exp1_final_report.md)

1. 정보원 서열: **조리 > 향미 ≫ 전통** (모든 축 유의 기여, 향미 +0.055 · 전통 +0.015)
2. 조리 부재 영역도 향미가 메움(0.271). 전통은 Random 수준(0.138)
3. **전통 축의 고유 가치** = 약선 조합 발굴. 전통 단독 377쌍 중 34개가 LLM 추천
   (대추+구기자·용안육 등), **Claude 21 vs Llama 7**로 LLM별 성향 관찰
4. 전통 축은 예측 feature가 아니라 "필터·설명"으로 써야 함

---

## 04_inputs — 데이터셋 재생성용 원천

`exp1_dataset.csv`를 다시 만들 때만 사용. 평소엔 볼 필요 없음.

| 파일 | 내용 |
|---|---|
| `herb_properties.csv` | 14 herb 성미귀경 |
| `candidate_properties.csv` | 후보 성미귀경 (기각 6건 excluded) |
| `candidate_mapping.csv` | 264 후보 → CHP 매핑 |
| `flavorgraph_match.csv` | FlavorGraph ↔ 어휘 매칭 |
| `flavorgraph_emb.npz` | FlavorGraph 임베딩 6653×300 (7MB) |

---

## 05_metrics — 원시 수치 (기계용)

리포트의 근거 JSON. 사람은 03_reports를 보면 됨.

| 파일 | 내용 |
|---|---|
| `coverage_stats.json` | 커버리지·pos_weight |
| `train_metrics.json` | PR-AUC/AUROC/P@20 (LLM별)·게이트 프로파일 |
| `gate_analysis.json` | 게이트 sharpness·herb별 게이트 |
| `final_stats.json` | 증분·t-test·축별·영역별 수치 |

---

## 주의

- 조리 PPMI는 RecipeDB 430 소표본 추정 → 노이즈 있음. 실험 2에서 RecipeNLG(223만)로 교체 시 검증.
- 라벨이 LLM 추천이라, "무엇이 LLM을 설명하나"이지 "무엇이 실제로 맛있나"가 아님.
- `우엉+우엉` 자기매칭 1건 존재(herb=candidate). 실사용 시 필터 필요. 라벨 [0,0,0]이라 학습엔 무해.
- 대추/대추야자는 별개 식물이나 RecipeDB·FlavorGraph에선 서양 date로 혼재.

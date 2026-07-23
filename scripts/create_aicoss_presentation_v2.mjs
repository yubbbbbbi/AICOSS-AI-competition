import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/AICOSS/outputs/aicoss_herb_pairing_presentation_v2.pptx";
const PREVIEW_DIR = "C:/AICOSS/outputs/aicoss_ppt_v2_preview";

const W = 1280;
const H = 720;
const C = {
  bg: "#FFFFFF",
  ink: "#101214",
  muted: "#626A73",
  light: "#F3F4F2",
  panel: "#ECEEEC",
  rule: "#C9CDC8",
  recipe: "#2F6EEA",
  flavor: "#F47A21",
  tcm: "#7B43D8",
  green: "#07966C",
  greenPale: "#EAF6F1",
  warmPale: "#FFF5EB",
  bluePale: "#EDF4FF",
  purplePale: "#F3EEFF",
};

function text(slide, value, x, y, w, h, opts = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = value;
  box.text.style = {
    fontSize: opts.size ?? 20,
    bold: opts.bold ?? false,
    color: opts.color ?? C.ink,
    alignment: opts.align ?? "left",
  };
  return box;
}

function box(slide, x, y, w, h, fill = C.light, line = C.rule, radius = "rounded-xl") {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

function rect(slide, x, y, w, h, fill, line = fill) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
  });
}

function header(slide, title, eyebrow = "AICOSS 약령시 프로젝트") {
  text(slide, eyebrow, 56, 34, 600, 26, { size: 14, bold: true, color: C.muted });
  text(slide, title, 56, 70, 1040, 58, { size: 38, bold: true });
  rect(slide, 56, 142, 1168, 2, C.rule);
}

function bullet(slide, items, x, y, w, opts = {}) {
  const size = opts.size ?? 21;
  const gap = opts.gap ?? 52;
  const color = opts.color ?? C.green;
  items.forEach((item, i) => {
    text(slide, "•", x, y + i * gap + 2, 24, 30, { size, bold: true, color });
    text(slide, item, x + 30, y + i * gap, w - 30, gap - 4, { size, color: opts.textColor ?? C.ink });
  });
}

function pill(slide, label, x, y, w, color) {
  box(slide, x, y, w, 38, color, color, "rounded-lg");
  text(slide, label, x + 10, y + 8, w - 20, 22, { size: 16, bold: true, color: "#FFFFFF", align: "center" });
}

function metric(slide, label, value, x, y, w, color = C.ink) {
  box(slide, x, y, w, 118, C.light, C.rule, "rounded-lg");
  text(slide, label, x + 18, y + 18, w - 36, 24, { size: 16, bold: true, color: C.muted });
  text(slide, value, x + 18, y + 52, w - 36, 42, { size: 34, bold: true, color });
}

function step(slide, num, title, body, x, y, w, color) {
  text(slide, String(num).padStart(2, "0"), x, y, 54, 34, { size: 22, bold: true, color });
  text(slide, title, x + 62, y, w - 62, 34, { size: 25, bold: true });
  text(slide, body, x + 62, y + 44, w - 62, 72, { size: 18, color: C.muted });
}

function arrow(slide, x, y, w, color = C.rule) {
  rect(slide, x, y + 12, w - 18, 3, color);
  const tri = slide.shapes.add({
    geometry: "triangle",
    position: { left: x + w - 24, top: y + 4, width: 22, height: 20 },
    fill: color,
    line: { style: "solid", fill: color, width: 1 },
  });
  tri.rotation = 90;
}

function scoreBar(slide, label, value, max, x, y, w, color) {
  text(slide, label, x, y - 8, 210, 24, { size: 17, bold: true });
  rect(slide, x + 225, y, w - 300, 14, "#E8ECE9");
  rect(slide, x + 225, y, (w - 300) * value / max, 14, color);
  text(slide, `${value}`, x + w - 62, y - 8, 60, 24, { size: 17, bold: true, align: "right" });
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

const deck = Presentation.create({ slideSize: { width: W, height: H } });

// 1. Title
{
  const s = deck.slides.add();
  s.background.fill = C.bg;
  text(s, "동대문구 약령시장 × 개인 카페", 56, 58, 780, 36, { size: 22, bold: true, color: C.green });
  text(s, "약재 메뉴 후보를\n설명 가능한 근거로 추천하는 AI 모듈", 56, 145, 850, 190, { size: 56, bold: true });
  text(s, "서비스 전체는 약령시 원료를 카페 신메뉴로 연결하고,\n본 발표는 그중 ‘추천 근거 검증’ 기능에 집중합니다.", 60, 424, 770, 78, { size: 25, color: C.muted });
  box(s, 890, 126, 310, 410, C.light, C.rule);
  text(s, "발표 초점", 925, 160, 230, 30, { size: 24, bold: true });
  bullet(s, [
    "LLM 추천의 설명 불가능성",
    "단일 전문가 방식의 한계",
    "3-Expert 근거 분해",
    "시연 가능한 추천 UI"
  ], 925, 228, 230, { size: 18, gap: 56 });
}

// 2. Service context
{
  const s = deck.slides.add();
  header(s, "서비스 문제는 약령시 원료가 카페 메뉴로 전환되지 못한다는 점입니다");
  metric(s, "개인 카페 5년 생존율", "55.3%", 72, 198, 245, C.flavor);
  metric(s, "프랜차이즈 생존율", "85.6%", 347, 198, 245, C.green);
  metric(s, "생존율 격차", "30.3%p", 622, 198, 245, C.ink);
  metric(s, "청년 유입 격차", "55%↓", 897, 198, 245, C.recipe);
  text(s, "현장 인터뷰에서 개인 카페는 약재 메뉴 개발의 원료 비용, 공급처 탐색, 메뉴 검증 부담을 반복적으로 언급했습니다.", 82, 382, 1030, 42, { size: 26, bold: true });
  bullet(s, [
    "약령시 원물은 음료·디저트로 가공될 때 소비 접근성이 높아집니다.",
    "개인 카페는 차별화 메뉴가 필요하지만, 약재와 어울리는 식재료 판단 근거가 부족합니다.",
    "따라서 단순 추천보다 ‘왜 이 조합을 믿을 수 있는지’가 서비스 채택의 핵심입니다."
  ], 92, 468, 1000, { size: 20, gap: 48 });
}

// 3. Problem definition
{
  const s = deck.slides.add();
  header(s, "좁힌 문제: LLM은 후보를 내지만 추천 근거를 독립적으로 검증하지 못합니다");
  box(s, 70, 190, 500, 330, C.light, C.rule);
  text(s, "LLM 단독 사용", 105, 225, 360, 36, { size: 30, bold: true });
  bullet(s, [
    "Top20 후보를 빠르게 생성",
    "설명도 함께 생성하지만 자기 검증은 아님",
    "틀린 추천도 그럴듯하게 설명할 위험"
  ], 110, 300, 380, { size: 21, gap: 64, color: C.flavor });
  box(s, 710, 190, 500, 330, C.greenPale, C.green);
  text(s, "우리의 문제 정의", 745, 225, 360, 36, { size: 30, bold: true, color: C.green });
  text(s, "약재-식재료 추천에서\nLLM 후보가 어떤 근거 축과 맞는지,\n또 최종 추천이 어떤 전문가 근거에서 왔는지\n수치와 UI로 설명한다.", 748, 300, 410, 150, { size: 28, bold: true });
}

// 4. Quantified scale
{
  const s = deck.slides.add();
  header(s, "문제 규모는 14개 약재와 264개 후보 식재료의 근거 행렬로 정의했습니다");
  metric(s, "약재", "14", 86, 195, 210, C.green);
  metric(s, "후보 식재료", "264", 326, 195, 230, C.recipe);
  metric(s, "전체 쌍", "3,696", 586, 195, 230, C.ink);
  metric(s, "LLM positive", "503", 846, 195, 230, C.flavor);
  text(s, "검증 가능한 단위", 86, 382, 280, 34, { size: 28, bold: true });
  text(s, "(약재, 후보 식재료) 한 쌍마다 RecipeDB, FlavorDB, iTCMDB 근거가 있는지와 어떤 순위인지 기록했습니다.", 86, 430, 980, 42, { size: 25 });
  text(s, "이렇게 해야 발표에서 ‘추천이 좋다’가 아니라 ‘어떤 근거가 얼마나 있는 추천인가’를 재현 가능한 지표로 말할 수 있습니다.", 86, 515, 980, 42, { size: 24, color: C.muted });
}

// 5. Technical gap
{
  const s = deck.slides.add();
  header(s, "기술적 공백은 LLM 설명 불가능성보다 넓습니다: 단일 전문가도 충분하지 않습니다");
  const data = [
    ["RecipeDB", "실제 함께 조리된 기록", "레시피 문화권과 수집 편향,\n맛·조리 관점에 치우침", C.recipe, C.bluePale],
    ["FlavorDB", "공유 향미 분자 기반", "분자 구조 중심이라 조리 맥락과\n전통 배합 근거를 설명하기 어려움", C.flavor, C.warmPale],
    ["iTCMDB", "성미귀경 기반 한방 지식", "한방 속성이 없는 현대 식재료와\n카페 재료 커버리지가 제한됨", C.tcm, C.purplePale],
  ];
  data.forEach((d, i) => {
    const x = 70 + i * 390;
    box(s, x, 190, 340, 350, d[4], C.rule);
    pill(s, d[0], x + 26, 224, 160, d[3]);
    text(s, "제공 근거", x + 28, 292, 160, 24, { size: 17, bold: true, color: C.muted });
    text(s, d[1], x + 28, 324, 270, 58, { size: 23, bold: true });
    text(s, "한계", x + 28, 415, 160, 24, { size: 17, bold: true, color: C.muted });
    text(s, d[2], x + 28, 447, 280, 70, { size: 19 });
  });
}

// 6. Alternatives
{
  const s = deck.slides.add();
  header(s, "더 단순한 대안은 예비 분석에서 배제했습니다");
  text(s, "Top-K 추천 간 평균 일치도", 82, 190, 420, 34, { size: 28, bold: true });
  scoreBar(s, "LLM ↔ LLM", 49, 50, 90, 270, 900, C.green);
  scoreBar(s, "Recipe ↔ LLM", 20, 50, 90, 345, 900, C.recipe);
  scoreBar(s, "FlavorDB ↔ 전체", 11, 50, 90, 420, 900, C.flavor);
  text(s, "LLM끼리는 서로 닮았지만, 실제 레시피·향미 DB와의 일치는 낮았습니다.", 90, 520, 1010, 34, { size: 27, bold: true });
  text(s, "따라서 여러 LLM의 합의만으로는 독립 검증이 아니라 공유된 학습 편향의 재확인일 수 있습니다.", 90, 566, 1010, 32, { size: 22, color: C.muted });
}

// 7. Architecture
{
  const s = deck.slides.add();
  header(s, "해결 방향은 생성과 검증을 분리한 3-Expert 추천 파이프라인입니다");
  const y = 250;
  box(s, 70, y, 220, 105, C.light, C.rule);
  text(s, "LLM 3종", 95, y + 24, 170, 28, { size: 27, bold: true, align: "center" });
  text(s, "후보 생성", 95, y + 61, 170, 24, { size: 18, color: C.muted, align: "center" });
  arrow(s, 320, y + 38, 95);
  box(s, 435, y - 44, 335, 193, C.greenPale, C.green);
  text(s, "3-Expert 근거 분해", 465, y - 10, 275, 32, { size: 28, bold: true, color: C.green, align: "center" });
  text(s, "RecipeDB\nFlavorDB\niTCMDB", 490, y + 48, 230, 88, { size: 25, bold: true, align: "center" });
  arrow(s, 795, y + 38, 95);
  box(s, 910, y, 260, 105, C.light, C.rule);
  text(s, "Fusion Top20", 940, y + 24, 200, 28, { size: 27, bold: true, align: "center" });
  text(s, "근거와 함께 제시", 940, y + 61, 200, 24, { size: 18, color: C.muted, align: "center" });
  text(s, "추천 모델은 현재 rank fusion 기반 MVP이며, 임베딩 기반 고도화는 별도 후보로 비교 중입니다.", 104, 500, 1000, 34, { size: 25, bold: true });
  text(s, "핵심은 최종 후보를 ‘점수만’ 주는 것이 아니라 어느 전문가 축에서 왔는지 함께 보여주는 것입니다.", 104, 548, 1000, 30, { size: 21, color: C.muted });
}

// 8. Data/features
{
  const s = deck.slides.add();
  header(s, "검증 모델은 12차원 입력으로 LLM 추천이 어떤 근거 축과 맞는지 학습했습니다");
  const cols = [
    ["조리 3-dim", "count\nrank inverse\nPMI", C.recipe],
    ["향미 2-dim", "FlavorGraph cosine\nFlavorDB rank inverse", C.flavor],
    ["한방 4-dim", "성질 차이\n맛 유사도\n귀경 overlap\n속성 존재 여부", C.tcm],
    ["마스크 3-dim", "조리 정보 유무\n향미 정보 유무\n한방 정보 유무", C.green],
  ];
  cols.forEach((c, i) => {
    const x = 68 + i * 292;
    box(s, x, 200, 250, 260, C.light, C.rule);
    pill(s, c[0], x + 24, 228, 170, c[2]);
    text(s, c[1], x + 28, 310, 190, 110, { size: 24, bold: true, align: "center" });
  });
  text(s, "마스크를 둔 이유", 86, 535, 260, 30, { size: 26, bold: true });
  text(s, "0점과 정보 부재를 구분해야 ‘근거가 낮은 조합’과 ‘근거가 없는 조합’을 다르게 해석할 수 있습니다.", 312, 535, 840, 34, { size: 23 });
}

// 9. Validation model
{
  const s = deck.slides.add();
  header(s, "LLM 설명 불가능성은 보조 모델로 정량 검증했습니다");
  box(s, 90, 205, 300, 130, C.bluePale, C.recipe);
  text(s, "입력", 120, 230, 240, 26, { size: 23, bold: true, color: C.recipe, align: "center" });
  text(s, "12-dim expert features", 120, 276, 240, 32, { size: 24, bold: true, align: "center" });
  arrow(s, 410, 260, 90);
  box(s, 520, 205, 300, 130, C.greenPale, C.green);
  text(s, "모델", 550, 230, 240, 26, { size: 23, bold: true, color: C.green, align: "center" });
  text(s, "ConcatMLP\n48 → 24", 550, 268, 240, 56, { size: 25, bold: true, align: "center" });
  arrow(s, 840, 260, 90);
  box(s, 950, 205, 250, 130, C.warmPale, C.flavor);
  text(s, "출력", 980, 230, 190, 26, { size: 23, bold: true, color: C.flavor, align: "center" });
  text(s, "Claude / Llama / GPT\nTop20 여부", 980, 268, 190, 56, { size: 22, bold: true, align: "center" });
  text(s, "이 모델의 목적은 ‘좋은 페어링 정답’을 만드는 것이 아니라, LLM 추천이 세 전문가 근거로 얼마나 설명되는지를 검증하는 것입니다.", 92, 435, 1020, 44, { size: 25, bold: true });
  text(s, "그래서 LLM 라벨을 메인 추천 정답으로 과장하지 않고, 설명 가능성 검증 지표로만 사용합니다.", 92, 505, 1020, 30, { size: 22, color: C.muted });
}

// 10. Execution results
{
  const s = deck.slides.add();
  header(s, "실행 결과는 데이터 커버리지와 LLM 근거 설명 가능성을 함께 보여줍니다");
  metric(s, "학습 가능 쌍", "2,323", 74, 195, 230, C.green);
  metric(s, "근거 없는 쌍", "1,373", 334, 195, 230, C.muted);
  metric(s, "한방 축 positive 커버", "65.6%", 594, 195, 260, C.tcm);
  metric(s, "3축 완전 근거 positive", "43%", 884, 195, 260, C.ink);
  box(s, 96, 395, 460, 148, C.light, C.rule);
  text(s, "재현성", 126, 420, 190, 26, { size: 24, bold: true });
  bullet(s, ["입력 feature 순서, mask, seed, epoch, 모델 구조를 파일로 고정", "최종 pt/pkl/json/csv 산출물을 저장"], 126, 466, 360, { size: 18, gap: 38 });
  box(s, 665, 395, 460, 148, C.greenPale, C.green);
  text(s, "해석", 695, 420, 190, 26, { size: 24, bold: true, color: C.green });
  text(s, "LLM 추천 중 상당 부분은 세 전문가 feature와 연결되지만,\n근거가 비어 있는 영역도 명시적으로 드러납니다.", 695, 466, 370, 54, { size: 21, bold: true });
}

// 11. Recommendation prototype
{
  const s = deck.slides.add();
  header(s, "메인 추천 기능은 사용자가 세 전문가의 신뢰도를 조절하는 방식입니다");
  box(s, 78, 185, 470, 330, C.light, C.rule);
  text(s, "Fusion score", 110, 220, 260, 32, { size: 30, bold: true });
  text(s, "wR × RecipeScore\n+ wF × FlavorScore\n+ wT × TCMScore\n+ 공통 근거 보너스", 110, 282, 360, 150, { size: 27, bold: true });
  text(s, "rank score = 21 - source rank", 110, 455, 330, 24, { size: 18, color: C.muted });
  box(s, 675, 185, 470, 330, C.greenPale, C.green);
  text(s, "시연 화면에서 보이는 것", 710, 220, 340, 32, { size: 30, bold: true, color: C.green });
  bullet(s, ["약재 선택", "RecipeDB / FlavorDB / iTCMDB 가중치 조절", "Fusion Top20 즉시 갱신", "원형 네트워크로 근거 edge 표시"], 710, 290, 350, { size: 20, gap: 50 });
}

// 12. Example explanation
{
  const s = deck.slides.add();
  header(s, "추천 결과는 점수보다 근거 분해를 먼저 읽게 설계했습니다");
  text(s, "예시: 생강 추천 후보", 88, 185, 420, 34, { size: 28, bold: true });
  const rows = [
    ["01", "시나몬", "Recipe 2위 · Flavor 16위", "두 소스 공통"],
    ["02", "레몬", "Recipe 5위 · Flavor 15위", "두 소스 공통"],
    ["03", "대추", "iTCMDB 1위", "한방 근거"],
    ["04", "설탕", "Recipe 1위", "조리 근거"],
  ];
  rows.forEach((r, i) => {
    const y = 250 + i * 72;
    rect(s, 88, y + 58, 990, 1, C.rule);
    text(s, r[0], 96, y, 54, 38, { size: 22, bold: true, color: C.muted });
    text(s, r[1], 165, y, 160, 38, { size: 26, bold: true });
    text(s, r[2], 365, y + 4, 350, 34, { size: 22, bold: true });
    text(s, r[3], 780, y + 4, 250, 34, { size: 22, color: C.green, bold: true });
  });
  text(s, "같은 1위라도 어떤 전문가의 1위인지가 함께 표시되어야 해석 가능한 추천이 됩니다.", 88, 575, 980, 34, { size: 25, bold: true });
}

// 13. Evaluation mapping
{
  const s = deck.slides.add();
  header(s, "평가 기준에는 ‘구현했다’보다 ‘왜 필요하고 어떻게 검증했는가’로 대응합니다");
  step(s, 1, "문제 정의", "카페 메뉴 후보 선택에서 LLM 추천 근거를 믿기 어렵다는 문제를 3,696개 쌍으로 수치화", 78, 190, 500, C.green);
  step(s, 2, "기술적 공백", "LLM·단일 전문가·LLM 합의가 각각 왜 부족한지 예비 overlap과 커버리지로 제시", 665, 190, 500, C.flavor);
  step(s, 3, "접근 근거", "Recipe, Flavor, TCM은 서로 다른 근거 유형이므로 분리하고, rank fusion으로 설명 가능하게 결합", 78, 360, 500, C.recipe);
  step(s, 4, "검증 설계", "LLM label 예측 모델은 추천 정답이 아니라 설명 가능성 검증 실험으로 명확히 구분", 665, 360, 500, C.tcm);
  text(s, "발표에서는 데이터 파일, 프롬프트, 코드, 웹 데모를 공개해 재현 가능성을 강조합니다.", 98, 588, 1000, 30, { size: 24, bold: true });
}

// 14. Limitations and close
{
  const s = deck.slides.add();
  header(s, "한계는 숨기지 않고, 다음 단계의 고도화 방향으로 연결합니다");
  box(s, 70, 190, 520, 330, C.light, C.rule);
  text(s, "현재 한계", 100, 225, 300, 34, { size: 30, bold: true });
  bullet(s, [
    "실제 소비자 선호 정답 라벨은 아직 없음",
    "TCM은 설명 feature이며 metric learning 라벨이 아님",
    "RecipeDB와 FlavorDB는 수집 편향과 커버리지 한계 존재",
    "설명 가능한 추천 모델은 현재 rank fusion MVP"
  ], 104, 290, 410, { size: 19, gap: 48, color: C.flavor });
  box(s, 690, 190, 520, 330, C.greenPale, C.green);
  text(s, "기대 효과", 720, 225, 300, 34, { size: 30, bold: true, color: C.green });
  bullet(s, [
    "264개 후보를 근거가 붙은 Top20으로 압축",
    "카페 사장이 조리·향미·한방 중 어떤 근거를 믿을지 조절",
    "약령시 원료를 메뉴 기획·검증·소싱으로 연결",
    "향후 소비자 평가 라벨로 추천 모델 고도화 가능"
  ], 724, 290, 410, { size: 19, gap: 48, color: C.green });
  text(s, "결론: 우리는 LLM 추천을 그대로 믿는 대신, 추천 근거를 분해하고 조절 가능한 형태로 보여주는 AI 메뉴 소싱 모듈을 만들었습니다.", 88, 590, 1060, 46, { size: 25, bold: true });
}

await fs.mkdir("C:/AICOSS/outputs", { recursive: true });
await fs.mkdir(PREVIEW_DIR, { recursive: true });

for (const [i, slide] of deck.slides.items.entries()) {
  const stem = `slide-${String(i + 1).padStart(2, "0")}`;
  await writeBlob(`${PREVIEW_DIR}/${stem}.png`, await deck.export({ slide, format: "png", scale: 1 }));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(`${PREVIEW_DIR}/${stem}.layout.json`, await layout.text());
}

await writeBlob(`${PREVIEW_DIR}/montage.webp`, await deck.export({ format: "webp", montage: true, scale: 1 }));
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(OUT);
console.log(OUT);

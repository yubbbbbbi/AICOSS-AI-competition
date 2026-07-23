import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/AICOSS/outputs/aicoss_herb_pairing_presentation_draft.pptx";
const PREVIEW_DIR = "C:/AICOSS/outputs/aicoss_ppt_preview";

const W = 1280;
const H = 720;
const C = {
  bg: "#FFFFFF",
  ink: "#111111",
  muted: "#666B73",
  panel: "#F0F1EF",
  panel2: "#F7F8F5",
  rule: "#D6D9D4",
  recipe: "#2F6EEA",
  flavor: "#F47A21",
  tcm: "#7B43D8",
  fusion: "#07966C",
  pale: "#EAF6F1",
};

function addText(slide, text, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: opts.size ?? 18,
    bold: opts.bold ?? false,
    color: opts.color ?? C.ink,
    alignment: opts.align ?? "left",
  };
  return shape;
}

function addBox(slide, x, y, w, h, fill = C.panel, line = C.rule) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: "rounded-xl",
  });
}

function addRect(slide, x, y, w, h, fill = C.panel, line = C.rule) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
  });
}

function addRule(slide, x, y, w, color = C.ink) {
  addRect(slide, x, y, w, 2, color, color);
}

function addPill(slide, text, x, y, w, color) {
  addBox(slide, x, y, w, 36, color, color);
  addText(slide, text, x + 12, y + 8, w - 24, 18, { size: 16, bold: true, color: "#FFFFFF", align: "center" });
}

function addHeader(slide, title, kicker = "AICOSS Herb Pairing") {
  addText(slide, kicker, 56, 36, 500, 28, { size: 14, bold: true, color: C.muted });
  addText(slide, title, 56, 72, 980, 52, { size: 38, bold: true });
  addRule(slide, 56, 136, 1168, C.rule);
}

function addBullets(slide, items, x, y, w, size = 20, gap = 44) {
  items.forEach((item, i) => {
    addText(slide, "•", x, y + i * gap + 1, 24, 28, { size, bold: true, color: C.fusion });
    addText(slide, item, x + 28, y + i * gap, w - 28, gap - 4, { size, color: C.ink });
  });
}

function addMetric(slide, label, value, x, y, w, color = C.ink) {
  addBox(slide, x, y, w, 112, C.panel2, C.rule);
  addText(slide, label, x + 18, y + 18, w - 36, 22, { size: 16, bold: true, color: C.muted });
  addText(slide, value, x + 18, y + 48, w - 36, 44, { size: 34, bold: true, color });
}

function addFlow(slide, labels, x, y, w, h, colors) {
  const gap = 22;
  const boxW = (w - gap * (labels.length - 1)) / labels.length;
  labels.forEach((label, i) => {
    const bx = x + i * (boxW + gap);
    addBox(slide, bx, y, boxW, h, colors[i] ?? C.panel2, colors[i] ?? C.rule);
    const [head, sub] = label.split("\n");
    addText(slide, head, bx + 16, y + 24, boxW - 32, 28, { size: 22, bold: true, color: colors[i] ? "#FFFFFF" : C.ink, align: "center" });
    if (sub) addText(slide, sub, bx + 16, y + 58, boxW - 32, 34, { size: 16, color: colors[i] ? "#FFFFFF" : C.muted, align: "center" });
    if (i < labels.length - 1) {
      addText(slide, "→", bx + boxW + 2, y + h / 2 - 16, gap - 4, 28, { size: 24, bold: true, color: C.muted, align: "center" });
    }
  });
}

function addBar(slide, label, value, max, x, y, w, color) {
  addText(slide, label, x, y, 150, 22, { size: 16, bold: true });
  addRect(slide, x + 160, y + 5, w - 240, 12, "#ECEFED", "#ECEFED");
  addRect(slide, x + 160, y + 5, (w - 240) * value / max, 12, color, color);
  addText(slide, String(value), x + w - 70, y - 2, 66, 22, { size: 16, bold: true, align: "right" });
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

const deck = Presentation.create({ slideSize: { width: W, height: H } });

// 1
{
  const s = deck.slides.add();
  s.background.fill = C.bg;
  addText(s, "Explainable Herb–Ingredient Pairing", 56, 64, 720, 42, { size: 22, bold: true, color: C.muted });
  addText(s, "LLM 추천을\n설명 가능한\n3-Expert Fusion으로 검증한다", 56, 156, 760, 270, { size: 58, bold: true });
  addText(s, "RecipeDB · FlavorDB · TCM-MKG 기반 약재-식재료 페어링 추천 시스템", 56, 520, 740, 36, { size: 24, color: C.muted });
  addBox(s, 850, 105, 340, 440, C.panel2, C.rule);
  addText(s, "15분 발표 초안", 884, 142, 260, 28, { size: 22, bold: true });
  addBullets(s, ["문제: LLM 추천은 근거가 불투명함", "방법: 세 독립 expert를 rank fusion", "검증: LLM 추천을 expert feature로 분석", "시연: 가중치 조절형 웹 데모"], 884, 205, 260, 18, 58);
}

// 2
{
  const s = deck.slides.add();
  addHeader(s, "문제는 추천 자체가 아니라, 추천 근거를 검증할 수 없다는 점이다");
  addBox(s, 70, 180, 500, 360, C.panel2, C.rule);
  addText(s, "기존 LLM 추천", 100, 214, 420, 32, { size: 28, bold: true });
  addBullets(s, ["그럴듯한 Top20을 빠르게 제시", "왜 그 재료가 맞는지는 모델 내부에 숨음", "설명도 같은 모델이 생성하므로 독립 검증이 아님"], 102, 286, 400, 20, 62);
  addBox(s, 704, 180, 500, 360, C.pale, C.fusion);
  addText(s, "우리의 문제정의", 734, 214, 420, 32, { size: 28, bold: true, color: C.fusion });
  addText(s, "약재-식재료 추천에서\n“무엇을 근거로 추천했는가”를\n조리·향미·전통 지식으로 분해해 보여준다.", 734, 300, 405, 145, { size: 25, bold: true });
}

// 3
{
  const s = deck.slides.add();
  addHeader(s, "예비 분석은 LLM끼리의 합의가 독립 검증이 아님을 보여준다");
  addText(s, "Top-K 추천 간 평균 일치도", 80, 180, 380, 28, { size: 24, bold: true });
  addBar(s, "LLM ↔ LLM", 49, 50, 92, 250, 760, C.fusion);
  addBar(s, "Recipe ↔ LLM", 20, 50, 92, 315, 760, C.recipe);
  addBar(s, "FlavorDB ↔ others", 11, 50, 92, 380, 760, C.flavor);
  addText(s, "LLM들은 실측 레시피나 향미 DB보다 서로를 더 닮았다.", 88, 500, 770, 34, { size: 24, bold: true });
  addText(s, "따라서 여러 LLM의 합의만으로는 독립적 근거 확인이 어렵다.", 88, 542, 770, 30, { size: 20, color: C.muted });
}

// 4
{
  const s = deck.slides.add();
  addHeader(s, "단일 expert는 넓은 페어링 공간을 충분히 설명하지 못한다");
  const cols = [
    ["RecipeDB", "실제 함께 조리된 기록", "약재가 적거나 문화권 편향 가능", C.recipe],
    ["FlavorDB", "분자/향미 유사성", "화학 데이터 부족 시 fallback 발생", C.flavor],
    ["TCM-MKG", "성미귀경 기반 전통 지식", "현대 식재료 커버리지 한계", C.tcm],
  ];
  cols.forEach((c, i) => {
    const x = 70 + i * 390;
    addBox(s, x, 190, 340, 310, C.panel2, C.rule);
    addPill(s, c[0], x + 28, 220, 170, c[3]);
    addText(s, c[1], x + 28, 292, 270, 54, { size: 23, bold: true });
    addText(s, c[2], x + 28, 390, 270, 70, { size: 19, color: C.muted });
  });
  addText(s, "결론: 세 축을 분리해서 유지하고, 최종 추천에서 근거를 함께 공개해야 한다.", 88, 575, 1060, 34, { size: 24, bold: true });
}

// 5
{
  const s = deck.slides.add();
  addHeader(s, "세 expert를 동일 후보 공간의 설명 가능한 feature로 정렬했다");
  addFlow(s, ["RecipeDB\nco-occurrence", "FlavorDB\nflavor similarity", "TCM-MKG\nproperty feature"], 90, 205, 1100, 118, [C.recipe, C.flavor, C.tcm]);
  addText(s, "공통 후보 공간", 120, 405, 260, 34, { size: 25, bold: true });
  addText(s, "14개 약재 × 264개 후보 = 3,696개 조합", 120, 455, 500, 34, { size: 24, bold: true, color: C.fusion });
  addBullets(s, ["모든 feature는 재료 단독이 아니라 (약재, 후보) 쌍 단위로 계산", "정보가 없는 축은 mask로 분리해 0값과 결측을 구분", "한방 속성은 라벨이 아니라 설명 feature로 사용"], 690, 394, 460, 18, 54);
}

// 6
{
  const s = deck.slides.add();
  addHeader(s, "데이터셋은 재현 가능한 12차원 검증 입력으로 정리했다");
  addMetric(s, "전체 조합", "3,696", 70, 190, 230, C.ink);
  addMetric(s, "학습 가능", "2,323", 330, 190, 230, C.fusion);
  addMetric(s, "근거 없음", "1,373", 590, 190, 230, C.muted);
  addMetric(s, "LLM positive", "503", 850, 190, 230, C.flavor);
  addText(s, "입력 feature", 85, 370, 300, 28, { size: 26, bold: true });
  addFlow(s, ["조리 3-dim\ncount/rank/PMI", "향미 2-dim\ncosine/rank", "전통 4-dim\n성·미·귀경", "마스크 3-dim\n정보 유무"], 85, 420, 1060, 105, [C.recipe, C.flavor, C.tcm, C.fusion]);
}

// 7
{
  const s = deck.slides.add();
  addHeader(s, "메인 추천은 학습보다 설명 가능한 rank fusion을 선택했다");
  addText(s, "왜 복잡한 딥러닝이 아닌가?", 76, 190, 480, 34, { size: 28, bold: true });
  addBullets(s, ["현재 데이터에는 검증된 ‘맛있다/부적합하다’ 정답 라벨이 없음", "LLM 라벨로 학습하면 LLM 모방 모델이 됨", "Top20 순위 데이터에는 rank fusion이 가장 직접적이고 방어 가능"], 78, 260, 520, 20, 58);
  addBox(s, 700, 196, 440, 280, C.pale, C.fusion);
  addText(s, "Final score", 728, 226, 350, 28, { size: 24, bold: true, color: C.fusion });
  addText(s, "wR·RecipeScore\n+ wF·FlavorScore\n+ wT·TCMScore\n+ agreement bonus", 728, 284, 350, 150, { size: 28, bold: true });
  addText(s, "사용자는 세 expert 가중치를 직접 조절한다.", 728, 485, 370, 28, { size: 19, color: C.muted });
}

// 8
{
  const s = deck.slides.add();
  addHeader(s, "성미귀경은 정답 라벨이 아니라 추천을 설명하는 한방 feature로 쓴다");
  addBox(s, 82, 190, 500, 340, C.panel2, C.rule);
  addText(s, "예: 생강 - 대추", 112, 220, 400, 34, { size: 30, bold: true });
  addBullets(s, ["성질: Warm - Warm", "맛: Pungent / Sweet", "귀경: Spleen, Stomach overlap", "전통 축에서 조합 근거를 설명 가능"], 116, 295, 390, 21, 58);
  addBox(s, 690, 190, 500, 340, "#FFF8F1", C.flavor);
  addText(s, "왜 라벨로 만들지 않았나", 720, 220, 420, 34, { size: 30, bold: true, color: C.flavor });
  addBullets(s, ["한방 positive/negative 라벨은 별도 문헌 근거가 필요", "임의 threshold는 공격 포인트가 됨", "따라서 속성값을 그대로 공개해 해석 가능성을 확보"], 724, 295, 390, 21, 58);
}

// 9
{
  const s = deck.slides.add();
  addHeader(s, "보조 모델은 LLM 추천을 세 expert feature로 설명 가능한지 검증한다");
  addFlow(s, ["12-dim input\nfeatures + masks", "ConcatMLP\n48 → 24", "3 outputs\nClaude/Llama/GPT"], 120, 218, 1040, 120, [C.recipe, C.fusion, C.flavor]);
  addText(s, "검증 질문", 110, 430, 240, 30, { size: 26, bold: true });
  addText(s, "LLM이 추천한 조합은 조리·향미·한방 feature만으로 어느 정도 예측되는가?", 110, 476, 920, 40, { size: 26, bold: true });
  addText(s, "해석: 이 모델은 ‘좋은 페어링 정답’을 학습한 것이 아니라 LLM 추천의 설명 가능성을 분석한다.", 110, 552, 980, 30, { size: 19, color: C.muted });
}

// 10
{
  const s = deck.slides.add();
  addHeader(s, "검증 설계는 성공 기준과 한계를 분리해 둔다");
  addBox(s, 70, 185, 530, 350, C.panel2, C.rule);
  addText(s, "성공 기준", 100, 220, 400, 32, { size: 30, bold: true });
  addBullets(s, ["세 expert 축이 LLM label보다 독립적인 근거를 제공", "가중치 변경 시 추천 결과와 근거가 일관되게 변함", "근거 없는 쌍은 명시적으로 제외 또는 표시"], 104, 298, 410, 21, 64);
  addBox(s, 680, 185, 530, 350, C.panel2, C.rule);
  addText(s, "측정 지표", 710, 220, 400, 32, { size: 30, bold: true });
  addBullets(s, ["Top-K overlap / Jaccard", "source coverage와 mask 조합", "LLM label 예측 성능", "추천별 source rank와 TCM feature"], 714, 298, 410, 21, 58);
}

// 11
{
  const s = deck.slides.add();
  addHeader(s, "웹 시연은 추천 결과와 근거 변화를 동시에 보여준다");
  addBox(s, 84, 180, 500, 365, C.panel2, C.rule);
  addText(s, "Fusion 추천 페이지", 114, 214, 400, 32, { size: 30, bold: true });
  addBullets(s, ["약재 선택", "RecipeDB / FlavorDB / iTCMDB 가중치 슬라이더", "Top20 추천과 원형 근거 네트워크", "후보별 source rank 표시"], 118, 295, 380, 20, 55);
  addBox(s, 704, 180, 500, 365, C.panel2, C.rule);
  addText(s, "LLM 검증 페이지", 734, 214, 400, 32, { size: 30, bold: true });
  addBullets(s, ["데이터 커버리지", "LLM label 분포", "축 조합별 mask", "약재별 후보 feature 확인"], 738, 295, 380, 20, 55);
}

// 12
{
  const s = deck.slides.add();
  addHeader(s, "실험 결과는 ‘근거 공개형 추천’의 필요성을 보여준다");
  addText(s, "관찰 1", 86, 190, 180, 28, { size: 22, bold: true, color: C.fusion });
  addText(s, "LLM 간 추천은 서로 수렴하지만, 레시피·향미 DB와는 낮은 일치도를 보인다.", 86, 226, 970, 34, { size: 26, bold: true });
  addText(s, "관찰 2", 86, 315, 180, 28, { size: 22, bold: true, color: C.recipe });
  addText(s, "세 expert는 서로 다른 빈틈을 갖기 때문에 단일 source보다 fusion이 방어 가능하다.", 86, 351, 970, 34, { size: 26, bold: true });
  addText(s, "관찰 3", 86, 440, 180, 28, { size: 22, bold: true, color: C.tcm });
  addText(s, "성미귀경은 추천 라벨보다 해석 feature로 사용할 때 근거 조작 위험이 낮다.", 86, 476, 970, 34, { size: 26, bold: true });
}

// 13
{
  const s = deck.slides.add();
  addHeader(s, "남은 한계는 명확하고, 확장 방향도 분명하다");
  addBox(s, 70, 185, 520, 340, C.panel2, C.rule);
  addText(s, "한계", 100, 220, 320, 32, { size: 30, bold: true });
  addBullets(s, ["RecipeDB 표본과 문화권 편향 가능", "FlavorDB 화학 데이터 fallback 이슈", "TCM-MKG의 현대 식재료 커버리지 부족", "정답 취향 라벨은 아직 없음"], 104, 295, 390, 20, 54);
  addBox(s, 690, 185, 520, 340, C.pale, C.fusion);
  addText(s, "기대 효과", 720, 220, 320, 32, { size: 30, bold: true, color: C.fusion });
  addBullets(s, ["LLM 추천을 그대로 쓰지 않고 근거를 분해", "사용자가 근거 축을 조절하는 실시간 추천", "향후 영양·가격·계절성 expert 추가 가능"], 724, 295, 390, 20, 62);
  addText(s, "결론: 설명 가능한 3-Expert Fusion으로 약재 페어링 추천의 신뢰성을 높인다.", 92, 592, 1040, 34, { size: 26, bold: true });
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

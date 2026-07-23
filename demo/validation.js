const state = {
  data: null,
  herbIndex: 0,
};

const els = {
  totalPairs: document.getElementById("total-pairs"),
  trainPairs: document.getElementById("train-pairs"),
  positivePairs: document.getElementById("positive-pairs"),
  excludedPairs: document.getElementById("excluded-pairs"),
  coverageChart: document.getElementById("coverage-chart"),
  labelChart: document.getElementById("label-chart"),
  comboChart: document.getElementById("combo-chart"),
  herbSelect: document.getElementById("validation-herb"),
  herbPositive: document.getElementById("herb-positive"),
  herbTwoPlus: document.getElementById("herb-two-plus"),
  herbAllThree: document.getElementById("herb-all-three"),
  herbActive: document.getElementById("herb-active"),
  candidateTbody: document.getElementById("candidate-tbody"),
};

const axisLabels = {
  cook: "조리",
  flavor: "향미",
  prop: "한방",
};

function fmt(value) {
  return Number(value).toLocaleString("ko-KR");
}

function pct(value, total) {
  if (!total) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function barRow(label, value, total, type = "total") {
  const row = document.createElement("div");
  row.className = "bar-row";
  const name = document.createElement("strong");
  name.textContent = label;
  const track = document.createElement("span");
  track.className = "bar-track";
  const fill = document.createElement("i");
  fill.className = `bar-fill ${type}`;
  fill.style.width = pct(value, total);
  track.appendChild(fill);
  const num = document.createElement("span");
  num.textContent = `${fmt(value)} (${pct(value, total)})`;
  row.append(name, track, num);
  return row;
}

function renderMeta() {
  const meta = state.data.meta;
  els.totalPairs.textContent = fmt(meta.totalPairs);
  els.trainPairs.textContent = fmt(meta.trainPairs);
  els.positivePairs.textContent = fmt(meta.positiveUnion);
  els.excludedPairs.textContent = fmt(meta.excludedAllMasked);
}

function renderCoverage() {
  const total = state.data.meta.totalPairs;
  const positives = state.data.meta.positiveUnion;
  els.coverageChart.replaceChildren();
  state.data.axisCoverage.forEach((axis) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    const name = document.createElement("strong");
    name.textContent = axisLabels[axis.axis];
    const bars = document.createElement("div");
    bars.className = "dual-bars";
    const totalBar = document.createElement("span");
    totalBar.className = "bar-track";
    const totalFill = document.createElement("i");
    totalFill.className = "bar-fill total";
    totalFill.style.width = pct(axis.total, total);
    totalBar.appendChild(totalFill);
    const posBar = document.createElement("span");
    posBar.className = "bar-track";
    const posFill = document.createElement("i");
    posFill.className = "bar-fill positive";
    posFill.style.width = pct(axis.positive, positives);
    posBar.appendChild(posFill);
    bars.append(totalBar, posBar);
    const label = document.createElement("span");
    label.textContent = `${pct(axis.total, total)} / ${pct(axis.positive, positives)}`;
    row.append(name, bars, label);
    els.coverageChart.appendChild(row);
  });
}

function renderLabels() {
  const meta = state.data.meta;
  els.labelChart.replaceChildren();
  els.labelChart.appendChild(barRow("Claude", meta.claudePositive, meta.totalPairs, "label"));
  els.labelChart.appendChild(barRow("Llama", meta.llamaPositive, meta.totalPairs, "label"));
  els.labelChart.appendChild(barRow("GPT", meta.gptPositive, meta.totalPairs, "label"));
  els.labelChart.appendChild(barRow("합집합", meta.positiveUnion, meta.totalPairs, "positive"));
}

function renderCombos() {
  const total = state.data.meta.totalPairs;
  els.comboChart.replaceChildren();
  state.data.axisCombos.forEach((combo) => {
    const cell = document.createElement("div");
    cell.className = "combo-cell";
    const code = document.createElement("code");
    code.textContent = combo.key.replaceAll("", " ").trim();
    const label = document.createElement("span");
    label.textContent = `cook/flavor/prop`;
    const bar = document.createElement("span");
    bar.className = "bar-track";
    const fill = document.createElement("i");
    fill.className = "bar-fill combo";
    fill.style.width = pct(combo.total, total);
    bar.appendChild(fill);
    const detail = document.createElement("span");
    detail.textContent = `${fmt(combo.total)}쌍 · positive ${fmt(combo.positive)}`;
    cell.append(code, label, bar, detail);
    els.comboChart.appendChild(cell);
  });
}

function pill(text, type, active = true) {
  const node = document.createElement("span");
  node.className = `mini-pill ${active ? type : "off"}`;
  node.textContent = text;
  return node;
}

function renderHerb() {
  const herb = state.data.herbs[state.herbIndex];
  els.herbPositive.textContent = fmt(herb.positive);
  els.herbTwoPlus.textContent = fmt(herb.twoPlus);
  els.herbAllThree.textContent = fmt(herb.allThree);
  els.herbActive.textContent = `${fmt(herb.coverage.active)} / ${fmt(herb.total)}`;
  els.candidateTbody.replaceChildren();

  herb.candidates.forEach((item) => {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.textContent = item.candidate;

    const llm = document.createElement("td");
    const llmPills = document.createElement("div");
    llmPills.className = "llm-pills";
    llmPills.append(
      pill("C", "claude", item.claude),
      pill("L", "llama", item.llama),
      pill("G", "gpt", item.gpt),
    );
    llm.appendChild(llmPills);

    const axes = document.createElement("td");
    const axisPills = document.createElement("div");
    axisPills.className = "axis-pills";
    axisPills.append(
      pill("조리", "cook", item.cook),
      pill("향미", "flavor", item.flavor),
      pill("한방", "prop", item.prop),
    );
    axes.appendChild(axisPills);

    const cook = document.createElement("td");
    cook.className = "feature-number";
    cook.textContent = `count ${item.cookCount.toFixed(2)} / PMI ${item.cookPmi.toFixed(2)}`;

    const flavor = document.createElement("td");
    flavor.className = "feature-number";
    flavor.textContent = `cos ${item.fgCosine.toFixed(3)} / rank ${item.fdbRankInv.toFixed(2)}`;

    const prop = document.createElement("td");
    prop.className = "feature-number";
    prop.textContent = `qi ${item.qiDiff.toFixed(1)} / wei ${item.weiJac.toFixed(2)} / gui ${item.guiJac.toFixed(2)}`;

    row.append(name, llm, axes, cook, flavor, prop);
    els.candidateTbody.appendChild(row);
  });
}

function initControls() {
  state.data.herbs.forEach((herb, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = herb.herb;
    els.herbSelect.appendChild(option);
  });
  const gingerIndex = state.data.herbs.findIndex((herb) => herb.herb === "생강");
  state.herbIndex = gingerIndex >= 0 ? gingerIndex : 0;
  els.herbSelect.value = String(state.herbIndex);
  els.herbSelect.addEventListener("change", () => {
    state.herbIndex = Number(els.herbSelect.value);
    renderHerb();
  });
}

function renderAll() {
  renderMeta();
  renderCoverage();
  renderLabels();
  renderCombos();
  renderHerb();
}

fetch("./data/llm-validation-data.json")
  .then((response) => response.json())
  .then((data) => {
    state.data = data;
    initControls();
    renderAll();
  })
  .catch((error) => {
    document.body.innerHTML = `<main class="app-shell"><section class="error-card"><h1>검증 데이터를 불러오지 못했습니다</h1><p>${error.message}</p></section></main>`;
  });

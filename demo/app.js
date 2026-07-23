const state = {
  data: null,
  ragData: null,
  herbIndex: 0,
  recipeRatio: 0.5,
  tcmPenaltyStrength: 0.4,
  tcmWeights: {
    temp: 0.5,
    taste: 0.25,
    meridian: 0.25,
  },
};

const els = {
  herbSelect: document.getElementById("herb-select"),
  recipeFlavorRatio: document.getElementById("recipe-flavor-ratio"),
  tcmPenaltyStrength: document.getElementById("tcm-penalty-strength"),
  recipeRatioValue: document.getElementById("recipe-ratio-value"),
  tcmPenaltyValue: document.getElementById("tcm-penalty-value"),
  tcmTriangle: document.getElementById("tcm-triangle"),
  tcmTrianglePoint: document.getElementById("tcm-triangle-point"),
  tcmResetButton: document.getElementById("tcm-reset-button"),
  tcmTempValue: document.getElementById("tcm-temp-value"),
  tcmTasteValue: document.getElementById("tcm-taste-value"),
  tcmMeridianValue: document.getElementById("tcm-meridian-value"),
  network: document.getElementById("fusion-network"),
  networkTitle: document.getElementById("network-title"),
  rankingList: document.getElementById("ranking-list"),
  contributionList: document.getElementById("contribution-list"),
  herbName: document.getElementById("herb-name"),
  consensusCount: document.getElementById("consensus-count"),
  topScore: document.getElementById("top-score"),
  referenceSummary: document.getElementById("reference-summary"),
  naverCount: document.getElementById("naver-count"),
  recipeRefCount: document.getElementById("recipe-ref-count"),
  cafeReferenceList: document.getElementById("cafe-reference-list"),
  recipeReferenceList: document.getElementById("recipe-reference-list"),
};

const svgns = "http://www.w3.org/2000/svg";
const sourceDefs = [
  { key: "recipe", label: "RecipeDB", rankKey: "recipeRank", color: "var(--recipe)" },
  { key: "flavor", label: "FlavorDB", rankKey: "flavorRank", color: "var(--flavor)" },
];
const TCM_PENALTY_SCALE = 12;
const tcmVertices = {
  temp: { x: 90, y: 18 },
  taste: { x: 24, y: 130 },
  meridian: { x: 156, y: 130 },
};

function svgEl(name, attrs = {}, text = "") {
  const node = document.createElementNS(svgns, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
}

function rankScore(rank) {
  return rank ? 21 - rank : 0;
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeWeights(weights) {
  const normalized = {
    temp: Math.max(0, Number(weights.temp) || 0),
    taste: Math.max(0, Number(weights.taste) || 0),
    meridian: Math.max(0, Number(weights.meridian) || 0),
  };
  const total = normalized.temp + normalized.taste + normalized.meridian;
  if (total <= 0) return { temp: 1 / 3, taste: 1 / 3, meridian: 1 / 3 };
  return {
    temp: normalized.temp / total,
    taste: normalized.taste / total,
    meridian: normalized.meridian / total,
  };
}

function pointFromTcmWeights(weights) {
  const normalized = normalizeWeights(weights);
  return {
    x: normalized.temp * tcmVertices.temp.x
      + normalized.taste * tcmVertices.taste.x
      + normalized.meridian * tcmVertices.meridian.x,
    y: normalized.temp * tcmVertices.temp.y
      + normalized.taste * tcmVertices.taste.y
      + normalized.meridian * tcmVertices.meridian.y,
  };
}

function tcmWeightsFromPoint(x, y) {
  const a = tcmVertices.temp;
  const b = tcmVertices.taste;
  const c = tcmVertices.meridian;
  const denominator = ((b.y - c.y) * (a.x - c.x)) + ((c.x - b.x) * (a.y - c.y));
  const temp = (((b.y - c.y) * (x - c.x)) + ((c.x - b.x) * (y - c.y))) / denominator;
  const taste = (((c.y - a.y) * (x - c.x)) + ((a.x - c.x) * (y - c.y))) / denominator;
  const meridian = 1 - temp - taste;
  return normalizeWeights({ temp, taste, meridian });
}

function tcmBalance(candidate) {
  const weights = normalizeWeights(state.tcmWeights);
  const components = [
    { key: "temp", value: numericOrNull(candidate.tempBalance), weight: weights.temp },
    { key: "taste", value: numericOrNull(candidate.tasteDiversity), weight: weights.taste },
    { key: "meridian", value: numericOrNull(candidate.meridianCoverage), weight: weights.meridian },
  ].filter((component) => component.value !== null && component.weight > 0);

  const coverage = components.reduce((sum, component) => sum + component.weight, 0);
  if (coverage <= 0) {
    return {
      balance: 1,
      coverage: 0,
      components: { temp: null, taste: null, meridian: null },
    };
  }

  const balance = components.reduce((sum, component) => {
    return sum + component.value * component.weight;
  }, 0) / coverage;

  return {
    balance: Math.max(0, Math.min(1, balance)),
    coverage,
    components: {
      temp: numericOrNull(candidate.tempBalance),
      taste: numericOrNull(candidate.tasteDiversity),
      meridian: numericOrNull(candidate.meridianCoverage),
    },
  };
}

function sourceSupport(candidate) {
  const support = sourceDefs
    .filter((source) => candidate[source.rankKey])
    .map((source) => ({ ...source, rank: candidate[source.rankKey], rankScore: rankScore(candidate[source.rankKey]) }));
  const tcm = tcmBalance(candidate);
  if (tcm.coverage > 0) {
    support.push({
      key: "tcm",
      label: "TCM Balance",
      color: "var(--tcm)",
      balance: tcm.balance,
      coverage: tcm.coverage,
      components: tcm.components,
    });
  }
  return support;
}

function scoreCandidate(candidate) {
  const support = sourceSupport(candidate);
  const recipeScore = rankScore(candidate.recipeRank);
  const flavorScore = rankScore(candidate.flavorRank);
  const recipeContribution = recipeScore * state.recipeRatio;
  const flavorContribution = flavorScore * (1 - state.recipeRatio);
  const baseScore = recipeContribution + flavorContribution;
  const tcm = tcmBalance(candidate);
  const tcmPenalty = state.tcmPenaltyStrength * (1 - tcm.balance) * tcm.coverage * TCM_PENALTY_SCALE;
  const fusionScore = baseScore - tcmPenalty;
  return {
    ...candidate,
    support,
    sourceCount: support.length,
    recipeContribution,
    flavorContribution,
    baseScore,
    tcmDynamicBalance: tcm.balance,
    tcmDynamicCoverage: tcm.coverage,
    tcmComponents: tcm.components,
    tcmPenalty,
    fusionScore,
  };
}

function rankedCandidates(herb) {
  return herb.candidates
    .map(scoreCandidate)
    .sort((a, b) => {
      const ranksA = a.support.map((source) => source.rank).filter(Boolean);
      const ranksB = b.support.map((source) => source.rank).filter(Boolean);
      const bestRankA = ranksA.length ? Math.min(...ranksA) : 9999;
      const bestRankB = ranksB.length ? Math.min(...ranksB) : 9999;
      return b.fusionScore - a.fusionScore
        || b.sourceCount - a.sourceCount
        || bestRankA - bestRankB
        || a.ingredient.localeCompare(b.ingredient, "ko");
    })
    .map((item, index, list) => {
      const displayScore = Number(item.fusionScore.toFixed(1));
      const previous = list[index - 1];
      const previousScore = previous ? Number(previous.fusionScore.toFixed(1)) : null;
      const displayRank = previous && displayScore === previousScore ? previous.displayRank : index + 1;
      return { ...item, fusionRank: index + 1, displayRank };
    });
}

function edgeType(candidate) {
  if (candidate.sourceCount >= 2) return "multi";
  return candidate.support[0]?.key || "recipe";
}

function edgeColor(candidate) {
  if (candidate.sourceCount >= 2) return "var(--multi)";
  return candidate.support[0]?.color || "var(--recipe)";
}

function edgeWidth(candidate) {
  return Math.max(0.7, 0.9 + candidate.fusionScore / 7 + Math.max(0, candidate.sourceCount - 1) * 0.8);
}

function polar(cx, cy, radius, angle) {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function evidenceText(candidate) {
  const ranks = candidate.support.map((source) => {
    if (source.key === "tcm") {
      const parts = source.components || {};
      const detail = [
        parts.temp !== null ? `온도 ${Math.round(parts.temp * 100)}` : null,
        parts.taste !== null ? `맛 ${Math.round(parts.taste * 100)}` : null,
        parts.meridian !== null ? `귀경 ${Math.round(parts.meridian * 100)}` : null,
      ].filter(Boolean).join(" · ");
      return `${source.label} ${Math.round(source.balance * 100)}점${detail ? ` (${detail})` : ""}`;
    }
    return `${source.label} ${source.rank}위`;
  }).join(" / ");
  return `${candidate.ingredient}: ${candidate.fusionScore.toFixed(2)}점 (${ranks || "근거 없음"})`;
}

function clearNetwork() {
  els.network.replaceChildren();
  els.network.appendChild(svgEl("title", {}, "3-Expert Fusion 추천 근거 네트워크"));
  els.network.appendChild(svgEl("desc", {}, "선 굵기는 fusion score, 색은 가장 강한 근거 source를 나타냅니다."));
}

function drawNetwork(herb, top20) {
  clearNetwork();
  const cx = 460;
  const cy = 330;
  const ringRadius = 265;
  const herbPoint = polar(cx, cy, ringRadius, -Math.PI / 2);
  const guideGroup = svgEl("g", { class: "guide-layer" });
  const edgeGroup = svgEl("g", { class: "edge-layer" });
  const labelGroup = svgEl("g", { class: "label-layer" });

  guideGroup.appendChild(svgEl("circle", { cx, cy, r: ringRadius, class: "network-ring" }));

  top20.forEach((candidate, index) => {
    const startAngle = -Math.PI / 2 + 0.42;
    const endAngle = Math.PI * 1.5 - 0.42;
    const angle = startAngle + index * ((endAngle - startAngle) / Math.max(1, top20.length - 1));
    const point = polar(cx, cy, ringRadius, angle);
    const pull = candidate.sourceCount >= 2 ? 0.46 : 0.34;
    const c1 = { x: herbPoint.x + (cx - herbPoint.x) * pull, y: herbPoint.y + (cy - herbPoint.y) * pull };
    const c2 = { x: point.x + (cx - point.x) * pull, y: point.y + (cy - point.y) * pull };
    const path = `M ${herbPoint.x.toFixed(1)} ${herbPoint.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const edge = svgEl("path", {
      d: path,
      class: `edge ${edgeType(candidate)}`,
      stroke: edgeColor(candidate),
      "stroke-width": edgeWidth(candidate).toFixed(2),
    });
    edge.appendChild(svgEl("title", {}, evidenceText(candidate)));
    edgeGroup.appendChild(edge);

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const anchor = cos < -0.16 ? "end" : cos > 0.16 ? "start" : "middle";
    const baseline = sin < -0.88 ? "auto" : sin > 0.88 ? "hanging" : "middle";
    const label = svgEl("text", {
      x: (point.x + cos * 17).toFixed(1),
      y: (point.y + sin * 17).toFixed(1),
      class: "ingredient-label",
      "text-anchor": anchor,
      "dominant-baseline": baseline,
    }, `${candidate.displayRank}. ${candidate.ingredient}`);
    label.appendChild(svgEl("title", {}, evidenceText(candidate)));
    labelGroup.appendChild(label);
  });

  const herbNode = svgEl("g", { class: "herb-node ring-herb" });
  herbNode.appendChild(svgEl("circle", { cx: herbPoint.x, cy: herbPoint.y, r: 32 }));
  herbNode.appendChild(svgEl("text", {
    x: herbPoint.x,
    y: herbPoint.y,
    "text-anchor": "middle",
    "dominant-baseline": "middle",
  }, herb.herb));

  els.network.append(guideGroup, edgeGroup, herbNode, labelGroup);
}

function sourceBadge(source) {
  const badge = document.createElement("span");
  badge.className = `source-badge ${source.key}`;
  if (source.key === "tcm") {
    badge.textContent = `TCM ${Math.round(source.balance * 100)}점`;
  } else {
    badge.textContent = `${source.label.replace("DB", "")} ${source.rank}위`;
  }
  return badge;
}

function renderRanking(top20) {
  els.rankingList.replaceChildren();
  top20.forEach((candidate) => {
    const row = document.createElement("li");
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(candidate.displayRank).padStart(2, "0");
    const main = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = candidate.ingredient;
    const badges = document.createElement("div");
    badges.className = "badge-row";
    candidate.support.forEach((source) => badges.appendChild(sourceBadge(source)));
    main.append(name, badges);
    const score = document.createElement("b");
    score.className = "score";
    score.textContent = candidate.fusionScore.toFixed(1);
    row.append(rank, main, score);
    els.rankingList.appendChild(row);
  });
}

function contributionBar(label, value, max, type) {
  const row = document.createElement("div");
  row.className = "contribution-row";
  const head = document.createElement("div");
  const name = document.createElement("span");
  name.textContent = label;
  const score = document.createElement("b");
  score.textContent = value.toFixed(2);
  head.append(name, score);
  const track = document.createElement("span");
  track.className = "contribution-track";
  const fill = document.createElement("i");
  fill.className = `contribution-fill ${type}`;
  fill.style.width = `${Math.max(4, (value / Math.max(1, max)) * 100).toFixed(1)}%`;
  track.appendChild(fill);
  row.append(head, track);
  return row;
}

function renderContributions(top20) {
  els.contributionList.replaceChildren();
  top20.slice(0, 5).forEach((candidate) => {
    const card = document.createElement("div");
    card.className = "contribution-card";
    const title = document.createElement("div");
    title.className = "contribution-title";
    const name = document.createElement("strong");
    name.textContent = `${candidate.displayRank}. ${candidate.ingredient}`;
    const score = document.createElement("span");
    score.textContent = `${candidate.fusionScore.toFixed(2)}점`;
    title.append(name, score);
    card.appendChild(title);
    const max = Math.max(candidate.baseScore, candidate.tcmPenalty, 1);
    if (candidate.recipeContribution > 0) {
      card.appendChild(contributionBar("RecipeDB", candidate.recipeContribution, max, "recipe"));
    }
    if (candidate.flavorContribution > 0) {
      card.appendChild(contributionBar("FlavorDB", candidate.flavorContribution, max, "flavor"));
    }
    if (candidate.tcmPenalty > 0) {
      card.appendChild(contributionBar("TCM 감점", candidate.tcmPenalty, max, "tcm"));
    }
    els.contributionList.appendChild(card);
  });
}

function currentRagReference(herbName) {
  return state.ragData?.herbs?.find((item) => item.herbKo === herbName) || null;
}

function buildRagQuery(herb, top20) {
  return {
    herb: herb.herb,
    ingredients: top20.map((item) => item.ingredient),
  };
}

function referenceSearchText(item) {
  return String(item.searchText || [
    item.name,
    item.rawName,
    item.description,
    item.cafe,
    item.titleKo,
    item.titleEn,
    item.ingredientPreview,
    item.stepPreview,
  ].filter(Boolean).join(" ")).toLowerCase();
}

function referenceMatch(item, query) {
  const text = referenceSearchText(item);
  const matchedIngredients = query.ingredients.filter((ingredient) => {
    const lower = String(ingredient).toLowerCase();
    return lower && text.includes(lower);
  });
  const herbMatched = text.includes(String(query.herb).toLowerCase());
  return {
    ...item,
    matchedRecommendedIngredients: matchedIngredients,
    ragScore: matchedIngredients.length * 10 + (herbMatched ? 3 : 0) + (item.imageUrl ? 1 : 0),
  };
}

function rankedReferences(items, query, limit = 6) {
  return (items || [])
    .map((item) => referenceMatch(item, query))
    .sort((a, b) => b.ragScore - a.ragScore
      || Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl))
      || (a.rank || 9999) - (b.rank || 9999)
      || String(a.name || a.titleKo || "").localeCompare(String(b.name || b.titleKo || ""), "ko"))
    .slice(0, limit);
}

function addMatchTags(parent, item) {
  const tags = item.matchedRecommendedIngredients || [];
  if (!tags.length) return;
  const row = document.createElement("div");
  row.className = "match-tags";
  tags.slice(0, 3).forEach((tag) => {
    const chip = document.createElement("i");
    chip.textContent = tag;
    row.appendChild(chip);
  });
  parent.appendChild(row);
}

function formatPrice(price) {
  if (!price && price !== 0) return "";
  return `${Number(price).toLocaleString("ko-KR")}원`;
}

function renderCafeReferences(reference, query) {
  els.cafeReferenceList.replaceChildren();
  const items = rankedReferences(reference?.cafeRefs || [], query, 6);
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-reference";
    empty.textContent = "네이버 실제 메뉴 레퍼런스가 아직 없습니다.";
    els.cafeReferenceList.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("a");
    card.className = "cafe-reference-card";
    card.href = item.sourceUrl || "#";
    card.target = "_blank";
    card.rel = "noreferrer";
    if (item.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = item.name;
      img.loading = "lazy";
      card.appendChild(img);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "image-fallback";
      fallback.textContent = "No image";
      card.appendChild(fallback);
    }
    const body = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.textContent = [item.cafe, formatPrice(item.priceKrw)].filter(Boolean).join(" · ");
    const desc = document.createElement("p");
    desc.textContent = item.description || "실제 카페 메뉴명 기반 레퍼런스";
    body.append(name, meta);
    addMatchTags(body, item);
    body.appendChild(desc);
    card.appendChild(body);
    els.cafeReferenceList.appendChild(card);
  });
}

function renderRecipeReferences(reference, query) {
  els.recipeReferenceList.replaceChildren();
  const items = rankedReferences(reference?.recipeRefs || [], query, 6);
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-reference";
    empty.textContent = "전세계 레시피 레퍼런스가 아직 없습니다.";
    els.recipeReferenceList.appendChild(empty);
    return;
  }
  items.forEach((item, index) => {
    const row = document.createElement("a");
    row.className = "recipe-reference-row";
    row.href = item.link?.startsWith("http") ? item.link : `https://${item.link}`;
    row.target = "_blank";
    row.rel = "noreferrer";
    const rank = document.createElement("span");
    rank.textContent = String(index + 1).padStart(2, "0");
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.titleKo || item.titleEn;
    const meta = document.createElement("small");
    meta.textContent = `${item.source || "recipe"} · score ${item.score ?? "-"}`;
    const preview = document.createElement("p");
    preview.textContent = item.ingredientPreview || item.stepPreview;
    body.append(title, meta);
    addMatchTags(body, item);
    body.appendChild(preview);
    row.append(rank, body);
    els.recipeReferenceList.appendChild(row);
  });
}

function renderReferences(herb, top20 = []) {
  if (!els.referenceSummary || !els.naverCount || !els.recipeRefCount || !els.cafeReferenceList || !els.recipeReferenceList) return;
  const reference = currentRagReference(herb.herb);
  const query = buildRagQuery(herb, top20);
  els.naverCount.textContent = "";
  els.recipeRefCount.textContent = "";
  els.referenceSummary.textContent = "Fusion Top20 기반 레퍼런스 검색";
  renderCafeReferences(reference, query);
  renderRecipeReferences(reference, query);
}

function render() {
  const herb = state.data.herbs[state.herbIndex];
  const ranked = rankedCandidates(herb);
  const top20 = ranked.slice(0, 20);
  els.networkTitle.textContent = `${herb.herb} Fusion 근거 네트워크`;
  els.herbName.textContent = herb.herb;
  els.consensusCount.textContent = top20.filter((item) => item.sourceCount >= 2).length;
  els.topScore.textContent = top20[0]?.fusionScore.toFixed(1) || "0.0";
  updateWeightLabels();
  drawNetwork(herb, top20);
  renderRanking(top20);
  renderContributions(top20);
  renderReferences(herb, top20);
}

function updateWeightLabels() {
  els.recipeRatioValue.textContent = `${Math.round(state.recipeRatio * 100)}%`;
  els.tcmPenaltyValue.textContent = `${Math.round(state.tcmPenaltyStrength * 100)}%`;
  const weights = normalizeWeights(state.tcmWeights);
  els.tcmTempValue.textContent = `${Math.round(weights.temp * 100)}%`;
  els.tcmTasteValue.textContent = `${Math.round(weights.taste * 100)}%`;
  els.tcmMeridianValue.textContent = `${Math.round(weights.meridian * 100)}%`;
  const point = pointFromTcmWeights(weights);
  els.tcmTrianglePoint.setAttribute("cx", point.x.toFixed(1));
  els.tcmTrianglePoint.setAttribute("cy", point.y.toFixed(1));
}

function setTcmWeights(weights) {
  state.tcmWeights = normalizeWeights(weights);
  render();
}

function initTriangleControl() {
  let dragging = false;

  const updateFromPointer = (event) => {
    const rect = els.tcmTriangle.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 180;
    const y = ((event.clientY - rect.top) / rect.height) * 150;
    state.tcmWeights = tcmWeightsFromPoint(x, y);
    render();
  };

  els.tcmTriangle.addEventListener("pointerdown", (event) => {
    dragging = true;
    els.tcmTriangle.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });

  els.tcmTriangle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    updateFromPointer(event);
  });

  els.tcmTriangle.addEventListener("pointerup", (event) => {
    dragging = false;
    els.tcmTriangle.releasePointerCapture(event.pointerId);
  });

  els.tcmTriangle.addEventListener("pointercancel", () => {
    dragging = false;
  });
}

function initControls() {
  state.data.herbs.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = item.herb;
    els.herbSelect.appendChild(option);
  });
  const gingerIndex = state.data.herbs.findIndex((item) => item.herb === "생강");
  state.herbIndex = gingerIndex >= 0 ? gingerIndex : 0;
  els.herbSelect.value = String(state.herbIndex);

  els.herbSelect.addEventListener("change", () => {
    state.herbIndex = Number(els.herbSelect.value);
    render();
  });

  els.recipeFlavorRatio.addEventListener("input", () => {
    state.recipeRatio = Number(els.recipeFlavorRatio.value);
    render();
  });

  els.tcmPenaltyStrength.addEventListener("input", () => {
    state.tcmPenaltyStrength = Number(els.tcmPenaltyStrength.value);
    render();
  });

  els.tcmResetButton.addEventListener("click", () => {
    setTcmWeights({ temp: 1, taste: 1, meridian: 1 });
  });

  initTriangleControl();
}

async function loadJsonWithInlineFallback(url, globalName, required = false) {
  if (window[globalName]) return window[globalName];
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} ${response.status}`);
    return await response.json();
  } catch (error) {
    if (required) throw error;
    console.warn(`${url} could not be loaded.`, error);
    return null;
  }
}

async function boot() {
  try {
    state.data = await loadJsonWithInlineFallback("./data/network-data.json", "__NETWORK_DATA__", true);
    state.ragData = await loadJsonWithInlineFallback("./data/rag-reference-data.json", "__RAG_REFERENCE_DATA__", false);
    initControls();
    render();
  } catch (error) {
    document.body.innerHTML = `<main class="app-shell"><section class="error-card"><h1>데이터를 불러오지 못했습니다</h1><p>${error.message}</p></section></main>`;
  }
}

boot();

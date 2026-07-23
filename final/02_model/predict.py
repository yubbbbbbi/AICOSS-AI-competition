# -*- coding: utf-8 -*-
"""
실험1 최종 추론 스크립트 (B5 ConcatMLP).
사용:
  python predict.py --herb 대추 --top 20
  python predict.py --herb 대추 --candidate 생강
  python predict.py --herb 대추 --sort axes
  python predict.py --herb 대추 --json
"""
import sys, csv, json, pickle, argparse
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
import torch, torch.nn as nn

# final/ 자립 실행: 모델은 이 폴더(02_model), 데이터는 01_dataset
HERE = Path(__file__).resolve().parent          # final/02_model
FINAL_ROOT = HERE.parent                         # final/
MODELS = HERE
DATASET = FINAL_ROOT / "01_dataset"

cfg = json.load(open(MODELS / "b5_config.json", encoding='utf-8'))
FEAT = cfg['feature_order']
GMASK = cfg['mask_order']
LAB = cfg['label_order']
scaler = pickle.load(open(MODELS / "scaler.pkl", 'rb'))
MU, SD = scaler['mean'], scaler['std']

class ConcatMLP(nn.Module):
    def __init__(s, in_dim=12, n=3, hidden=48, p=0.3):
        super().__init__()
        s.net = nn.Sequential(nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(p),
                              nn.Linear(hidden, 24), nn.ReLU(), nn.Linear(24, n))
    def forward(s, x): return s.net(x)

model = ConcatMLP(12)
model.load_state_dict(torch.load(MODELS / "b5_final.pt"))
model.eval()

# 데이터 로드 (전체 3696 — 세 축 부재 쌍도 추론 표시용)
rows = list(csv.DictReader(open(DATASET / "exp1_dataset.csv", encoding='utf-8-sig')))
for r in rows:
    for c in FEAT: r[c] = float(r[c])
    for c in GMASK: r[c] = int(r[c])
    if not r['mask_flavor']: r['fdb_rank_inv'] = 0.0
by_herb = {}
for r in rows:
    by_herb.setdefault(r['herb'], []).append(r)

def predict(rs):
    X = np.array([[r[c] for c in FEAT] for r in rs], np.float32)
    M = np.array([[r[c] for c in GMASK] for r in rs], np.float32)
    Xz = (X - MU) / SD
    inp = torch.tensor(np.concatenate([Xz, M], 1).astype(np.float32))
    with torch.no_grad():
        prob = torch.sigmoid(model(inp)).numpy()   # N×3 (claude/llama/gpt)
    return prob

def build(r, prob):
    m = {g: int(r[g]) for g in GMASK}
    axes = m['mask_cook'] + m['mask_flavor'] + m['mask_prop']
    return {
        'candidate': r['candidate'], 'score': float(prob.mean()),
        'llm_scores': {'claude': float(prob[0]), 'llama': float(prob[1]), 'gpt': float(prob[2])},
        'axes': {'cook': bool(m['mask_cook']), 'flavor': bool(m['mask_flavor']), 'prop': bool(m['mask_prop'])},
        'n_axes': axes,
        'features': {'cook_pmi': round(r['cook_pmi'], 3), 'fg_cosine': round(r['fg_cosine'], 3),
                     'qi_diff': round(r['qi_diff'], 3), 'wei_jac': round(r['wei_jac'], 3),
                     'gui_jac': round(r['gui_jac'], 3)},
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--herb', required=True)
    ap.add_argument('--candidate')
    ap.add_argument('--top', type=int, default=20)
    ap.add_argument('--sort', choices=['score', 'axes'], default='score')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()

    if a.herb not in by_herb:
        print(f"herb '{a.herb}' 없음. 가능: {sorted(by_herb)}"); return
    rs = by_herb[a.herb]
    if a.candidate:
        rs = [r for r in rs if r['candidate'] == a.candidate]
        if not rs:
            print(f"candidate '{a.candidate}' 없음"); return
    probs = predict(rs)
    items = [build(r, probs[i]) for i, r in enumerate(rs)]
    if a.sort == 'axes':
        items.sort(key=lambda x: (-x['n_axes'], -x['score']))
    else:
        items.sort(key=lambda x: -x['score'])
    items = items[:a.top] if not a.candidate else items

    if a.json:
        print(json.dumps({'herb': a.herb, 'model': 'b5_final', 'recommendations': items},
                         ensure_ascii=False, indent=2))
        return

    print(f"\n{a.herb} (herb)  — 모델 B5 ConcatMLP\n")
    print(f"{'rank':>4} {'candidate':<14} {'score':>6}  {'cook':>4} {'flavor':>6} {'prop':>4} {'axes':>4}")
    for i, it in enumerate(items, 1):
        ax = it['axes']
        c = 'O' if ax['cook'] else '-'; f = 'O' if ax['flavor'] else '-'; p = 'O' if ax['prop'] else '-'
        tag = ''
        if it['n_axes'] == 1 and ax['prop']: tag = '  [전통 단독]'
        elif it['n_axes'] == 0: tag = '  [근거 없음]'
        rk = f"{i:>4}" if it['n_axes'] >= 2 else "   —"
        print(f"{rk} {it['candidate']:<14} {it['score']:>6.2f}  {c:>4} {f:>6} {p:>4} {it['n_axes']:>4}{tag}")

if __name__ == '__main__':
    main()

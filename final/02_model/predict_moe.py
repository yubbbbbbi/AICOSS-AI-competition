# -*- coding: utf-8 -*-
"""
MoE 추론 (참고용). B5 predict.py와 동일 인터페이스 + 게이트 가중치 표시.
게이트 [cook, flavor, prop] = 각 축을 얼마나 반영했는가.
사용:
  python predict_moe.py --herb 대추 --top 15
  python predict_moe.py --herb 대추 --candidate 시나몬 --json
"""
import sys, csv, json, pickle, argparse
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F

HERE = Path(__file__).resolve().parent
DATASET = HERE.parent / "01_dataset"

cfg = json.load(open(HERE / "b5_config.json", encoding='utf-8'))
FEAT = cfg['feature_order']; GMASK = cfg['mask_order']; LAB = cfg['label_order']
GROUPS = [('cook', ['cook_count','cook_rank_inv','cook_pmi']),
          ('flavor', ['fg_cosine','fdb_rank_inv']),
          ('prop', ['qi_diff','qi_B','wei_jac','gui_jac'])]
sl=[]; i=0
for _,cols in GROUPS: sl.append(slice(i,i+len(cols))); i+=len(cols)
scaler = pickle.load(open(HERE / "scaler.pkl", 'rb'))
MU, SD = scaler['mean'], scaler['std']

class MoE(nn.Module):
    def __init__(s, dims=(3,2,4), hidden=32, out=16, n=3, p=0.3):
        super().__init__()
        s.experts=nn.ModuleList([nn.Sequential(nn.Linear(d,hidden),nn.ReLU(),nn.Dropout(p),
                    nn.Linear(hidden,out),nn.ReLU()) for d in dims])
        s.gate=nn.Linear(sum(dims)+3,3); s.head=nn.Linear(out,n)
    def forward(s, xs, m):
        h=torch.stack([e(x) for e,x in zip(s.experts,xs)],1)*m.unsqueeze(-1)
        lg=s.gate(torch.cat(xs+[m.float()],-1)).masked_fill(~m.bool(),-1e9)
        w=F.softmax(lg,-1)
        return s.head((w.unsqueeze(-1)*h).sum(1)), w

model = MoE(); model.load_state_dict(torch.load(HERE / "moe_final.pt")); model.eval()

rows = list(csv.DictReader(open(DATASET / "exp1_dataset.csv", encoding='utf-8-sig')))
for r in rows:
    for c in FEAT: r[c]=float(r[c])
    for c in GMASK: r[c]=int(r[c])
    if not r['mask_flavor']: r['fdb_rank_inv']=0.0
by_herb={}
for r in rows: by_herb.setdefault(r['herb'],[]).append(r)

def predict(rs):
    X=np.array([[r[c] for c in FEAT] for r in rs],np.float32)
    M=np.array([[r[c] for c in GMASK] for r in rs],np.float32)
    Xz=(X-MU)/SD
    xs=[torch.tensor(Xz[:,s]) for s in sl]; mt=torch.tensor(M)
    with torch.no_grad():
        logit,w = model(xs, mt)
        prob=torch.sigmoid(logit).numpy(); gate=w.numpy()
    return prob, gate

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--herb',required=True); ap.add_argument('--candidate')
    ap.add_argument('--top',type=int,default=15)
    ap.add_argument('--sort',choices=['score','axes'],default='score')
    ap.add_argument('--json',action='store_true')
    a=ap.parse_args()
    if a.herb not in by_herb:
        print(f"herb '{a.herb}' 없음"); return
    rs=by_herb[a.herb]
    if a.candidate:
        rs=[r for r in rs if r['candidate']==a.candidate]
        if not rs: print("candidate 없음"); return
    prob,gate=predict(rs)
    items=[]
    for i,r in enumerate(rs):
        m={g:int(r[g]) for g in GMASK}
        items.append({'candidate':r['candidate'],'score':float(prob[i].mean()),
            'llm_scores':{'claude':float(prob[i,0]),'llama':float(prob[i,1]),'gpt':float(prob[i,2])},
            'gate':{'cook':float(gate[i,0]),'flavor':float(gate[i,1]),'prop':float(gate[i,2])},
            'axes':{'cook':bool(m['mask_cook']),'flavor':bool(m['mask_flavor']),'prop':bool(m['mask_prop'])},
            'n_axes':m['mask_cook']+m['mask_flavor']+m['mask_prop']})
    items.sort(key=(lambda x:(-x['n_axes'],-x['score'])) if a.sort=='axes' else (lambda x:-x['score']))
    if not a.candidate: items=items[:a.top]
    if a.json:
        print(json.dumps({'herb':a.herb,'model':'moe_final','recommendations':items},ensure_ascii=False,indent=2)); return
    print(f"\n{a.herb} (herb)  — 모델 ThreeExpertMoE  [gate = 축별 반영 비율]\n")
    print(f"{'rank':>4} {'candidate':<12} {'score':>6}  {'gate(cook/flav/prop)':<22} {'axes':>4}")
    for i,it in enumerate(items,1):
        g=it['gate']
        gs=f"{g['cook']:.2f}/{g['flavor']:.2f}/{g['prop']:.2f}"
        rk=f"{i:>4}" if it['n_axes']>=2 else "   —"
        tag=' [근거없음]' if it['n_axes']==0 else ''
        print(f"{rk} {it['candidate']:<12} {it['score']:>6.2f}  {gs:<22} {it['n_axes']:>4}{tag}")

if __name__=='__main__': main()

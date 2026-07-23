# -*- coding: utf-8 -*-
"""
해석가능 MoE 추론 (sigmoid gate + linear expert).
선형이라 gate·contribution·feature 수준 분해까지 제공.
사용:
  python predict_imoe.py --herb 대추 --top 20
  python predict_imoe.py --herb 마 --sort axes
  python predict_imoe.py --herb 대추 --candidate 생강 --json
"""
import sys, csv, json, pickle, argparse
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F

HERE=Path(__file__).resolve().parent; DATASET=HERE.parent/"01_dataset"
cfg=json.load(open(HERE/"interpretable_config.json",encoding='utf-8'))
FEAT=cfg['feature_order']; GMASK=cfg['mask_order']; LAB=cfg['label_order']
GROUPS=[('cook',['cook_count','cook_rank_inv','cook_pmi']),('flavor',['fg_cosine','fdb_rank_inv']),
        ('prop',['qi_diff','qi_B','wei_jac','gui_jac'])]
sl=[]; i=0
for _,c in GROUPS: sl.append(slice(i,i+len(c))); i+=len(c)
sc=pickle.load(open(HERE/"scaler_imoe.pkl",'rb')); MU,SD=sc['mean'],sc['std']
coefs=json.load(open(HERE/"coefficients.json",encoding='utf-8'))['coefficients']

class IMoE(nn.Module):
    def __init__(s,dims=(3,2,4),n=3):
        super().__init__()
        s.experts=nn.ModuleList([nn.Linear(d,1) for d in dims]); s.head=nn.Linear(3,n)
        s.gate=nn.Linear(sum(dims)+3,3)
    def forward(s,xs,mask):
        lg=s.gate(torch.cat(xs+[mask.float()],-1)); w=torch.sigmoid(lg)*mask.float()
        h=torch.cat([e(x) for e,x in zip(s.experts,xs)],-1); contrib=w*h
        return s.head(contrib),w,contrib,h
model=IMoE(); model.load_state_dict(torch.load(HERE/"interpretable_moe.pt")); model.eval()

rows=list(csv.DictReader(open(DATASET/"exp1_dataset.csv",encoding='utf-8-sig')))
raw={}
for r in rows:
    for c in FEAT: r[c]=float(r[c])
    for c in GMASK: r[c]=int(r[c])
    if not r['mask_flavor']: r['fdb_rank_inv']=0.0
by={}
for r in rows: by.setdefault(r['herb'],[]).append(r)

def run(rs):
    X=np.array([[r[c] for c in FEAT] for r in rs],np.float32)
    M=np.array([[r[c] for c in GMASK] for r in rs],np.float32)
    Xz=(X-MU)/SD
    with torch.no_grad():
        lg,w,contrib,h=model([torch.tensor(Xz[:,s]) for s in sl],torch.tensor(M))
        prob=torch.sigmoid(lg).numpy()
    return prob,w.numpy(),contrib.numpy(),M,Xz

def build(r,prob,w,contrib,Xz):
    m={g:int(r[g]) for g in GMASK}
    na=m['mask_cook']+m['mask_flavor']+m['mask_prop']
    item={'candidate':r['candidate'],'score':float(prob.mean()),
        'llm_scores':{'claude':float(prob[0]),'llama':float(prob[1]),'gpt':float(prob[2])},
        'gate':{'cook':float(w[0]),'flavor':float(w[1]),'prop':float(w[2])},
        'contribution':{'cook':float(contrib[0]),'flavor':float(contrib[1]),'prop':float(contrib[2])},
        'axes':{'cook':bool(m['mask_cook']),'flavor':bool(m['mask_flavor']),'prop':bool(m['mask_prop'])},
        'n_axes':na}
    # prop_detail (선형이므로 feature 수준 분해)
    if m['mask_prop']:
        det={}
        for ci,col in enumerate(GROUPS[2][1]):
            zval=float(Xz[sl[2]][ci]); coef=coefs[col]
            det[col]={'value':round(float(r[col]),3),'coef':round(coef,3),
                      'contrib':round(zval*coef*float(w[2]),4)}
        item['prop_detail']=det
    return item

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--herb',required=True); ap.add_argument('--candidate')
    ap.add_argument('--top',type=int,default=20); ap.add_argument('--sort',choices=['score','axes'],default='score')
    ap.add_argument('--json',action='store_true'); a=ap.parse_args()
    if a.herb not in by: print(f"herb '{a.herb}' 없음"); return
    rs=by[a.herb]
    if a.candidate:
        rs=[r for r in rs if r['candidate']==a.candidate]
        if not rs: print("candidate 없음"); return
    prob,w,contrib,M,Xz=run(rs)
    items=[build(rs[i],prob[i],w[i],contrib[i],Xz[i]) for i in range(len(rs))]
    items.sort(key=(lambda x:(-x['n_axes'],-x['score'])) if a.sort=='axes' else (lambda x:-x['score']))
    if not a.candidate: items=items[:a.top]
    if a.json:
        print(json.dumps({'herb':a.herb,'model':'interpretable_moe','recommendations':items},ensure_ascii=False,indent=2)); return
    print(f"\n{a.herb} (herb)  — InterpretableMoE (sigmoid gate·linear expert)\n")
    print(f"{'rank':>4} {'candidate':<12} {'score':>6}  {'gate(c/f/p)':<16} {'contrib(c/f/p)':<20} {'ax':>3}")
    for i,it in enumerate(items,1):
        g=it['gate']; c=it['contribution']
        gs=f"{g['cook']:.2f}/{g['flavor']:.2f}/{g['prop']:.2f}"
        cs=f"{c['cook']:+.2f}/{c['flavor']:+.2f}/{c['prop']:+.2f}"
        rk=f"{i:>4}" if it['n_axes']>=2 else "   —"
        tag=' [근거없음]' if it['n_axes']==0 else ''
        print(f"{rk} {it['candidate']:<12} {it['score']:>6.2f}  {gs:<16} {cs:<20} {it['n_axes']:>3}{tag}")

if __name__=='__main__': main()

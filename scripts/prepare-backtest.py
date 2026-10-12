import csv,json,collections,hashlib,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
source=root/'research/2025-26.csv'
rows=list(csv.DictReader(source.open(encoding='utf-8')))
bygw=collections.defaultdict(lambda:collections.defaultdict(list))
for r in rows: bygw[int(r['GW'])][int(r['element'])].append(r)
history=collections.defaultdict(dict); teams={}; frames=[]
number=lambda r,k:float(r.get(k) or 0)
positions={'GK':1,'GKP':1,'DEF':2,'MID':3,'FWD':4}
for gw in range(1,max(bygw)+1):
    elements=[]
    if gw>=6:
        for pid,past in history.items():
            last=past[max(past)]; window=[past.get(g,{}) for g in range(max(1,gw-5),gw)]
            mins=sum(x.get('minutes',0) for x in window); count=len(window)
            per90=lambda k:sum(x.get(k,0) for x in window)*90/mins if mins else 0
            elements.append(dict(id=pid,web_name=last['name'],team=last['team'],element_type=last['position'],now_cost=last['value'],status='a',chance_of_playing_next_round=None,form=sum(x.get('points',0) for x in window)/count,points_per_game=0,minutes=mins,gamesPlayed=count,recentMinutes=min(90,mins/count),expected_goals_per_90=per90('xg'),expected_assists_per_90=per90('xa'),expected_goals_conceded_per_90=per90('xgc'),saves_per_90=per90('saves'),defensive_contribution_per_90=per90('defensive')))
        frames.append(dict(gw=gw,elements=elements,actual={pid:sum(number(r,'total_points') for r in rr) for pid,rr in bygw[gw].items()},minutes={pid:sum(number(r,'minutes') for r in rr) for pid,rr in bygw[gw].items()}))
    for pid,rr in bygw[gw].items():
        r=rr[-1]; team=r['team']; teams.setdefault(team,len(teams)+1)
        history[pid][gw]=dict(name=r['name'],position=positions[r['position']],team=teams[team],value=int(number(r,'value')),minutes=sum(number(x,'minutes') for x in rr),points=sum(number(x,'total_points') for x in rr),xg=sum(number(x,'expected_goals') for x in rr),xa=sum(number(x,'expected_assists') for x in rr),xgc=sum(number(x,'expected_goals_conceded') for x in rr),saves=sum(number(x,'saves') for x in rr),defensive=sum(number(x,'defensive_contribution') for x in rr))
(root/'research/frames.json').write_text(json.dumps(frames))
print(json.dumps(dict(frames=len(frames),sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest())))

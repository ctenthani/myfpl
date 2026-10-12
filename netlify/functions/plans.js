const core=require('./lib/account-core');
const {scope,validate}=require('./lib/team-records');
const {realised}=require('./lib/outcomes');
async function official(path){const r=await fetch('https://fantasy.premierleague.com/api/'+path,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Official results unavailable.');return r.json();}
exports.handler=async event=>{try{
  if(event.httpMethod!=='POST')return core.response(405,{error:'Method not allowed.'});
  if(!core.sameOrigin(event))return core.response(403,{error:'Open MyFPL to sync.'});
  const b=core.body(event),teamId=Number(b.teamId);if(!Number.isSafeInteger(teamId)||teamId<=0||teamId>100000000)return core.response(400,{error:'Choose a team.'});
  const {store,key}=await scope(event,teamId);
  if(b.action==='load'){const row=await store.getWithMetadata(key,{type:'json'});return core.response(200,{state:row?.data?.state||null,revision:row?.data?.revision||0,savedAt:row?.data?.savedAt||null});}
  if(b.action==='save'){
    const state=validate(b.state,teamId),old=await store.getWithMetadata(key,{type:'json'});
    if(Number(b.revision)!==(old?.data?.revision||0))return core.response(409,{error:'Another device saved a newer plan. Load it before saving.'});
    const revision=(old?.data?.revision||0)+1,savedAt=new Date().toISOString();
    const changed=await store.setJSON(key,{state,revision,savedAt},old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
    return core.response(changed.modified?200:409,changed.modified?{revision,savedAt}:{error:'Plan changed concurrently. Load the cloud plan.'});
  }
  if(b.action==='history'){
    const journal=await store.get(key+':journal',{type:'json'}),records=journal?.records||[];
    const [boot,entryHistory]=await Promise.all([official('bootstrap-static/'),official(`entry/${teamId}/history/`)]),positions=Object.fromEntries(boot.elements.map(p=>[p.id,p.element_type]));
    const finished=new Set(boot.events.filter(g=>g.finished&&g.data_checked).map(g=>g.id));
    const season=boot.events[0]?.deadline_time?.slice(0,4);
    const rows=await Promise.all(records.slice(-6).map(async record=>{
      const row={...record,status:'Awaiting final checked results'};
      if(record.season===season&&finished.has(record.gameweek)){
        const live=await official(`event/${record.gameweek}/live/`),actual=Object.fromEntries(live.elements.map(p=>[p.id,{minutes:p.stats.minutes,points:p.stats.total_points}]));
        row.recommendedPoints=realised(record.chosen,actual,positions);row.holdPoints=realised(record.base,actual,positions);row.difference=row.recommendedPoints-row.holdPoints;row.forecastError=row.recommendedPoints-record.forecast;row.status='Final player results · hypothetical plan';
        const manager=entryHistory.current.find(g=>g.event===record.gameweek);
        if(manager)row.managerPoints=manager.points-manager.event_transfers_cost;
      }return row;
    }));
    return core.response(200,{records:rows,note:'Recommendations are locked before deadlines. Scores replay planned XI, captain, substitutes and hits; they do not prove you submitted the plan or that MyFPL caused rank changes.'});
  }
  return core.response(400,{error:'Unknown plan action.'});
}catch(error){return core.response(error.status||503,{error:error.status?error.message:'Team-plan service unavailable. Local plans remain intact.'});}};

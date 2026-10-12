const core=require('./account-core');
async function scope(event,teamId){
  const session=core.session(event);if(!session)throw Object.assign(Error('Sign in to sync private team plans.'),{status:401});
  const store=core.store(),user=await store.get('user:'+session.sub,{type:'json'});
  const owner=process.env.OWNER_EMAIL&&user?.email===process.env.OWNER_EMAIL.trim().toLowerCase();
  if(!user||!(Number(user.teamId)===teamId||(owner&&user.teams?.some(t=>t.teamId===teamId))))throw Object.assign(Error('This team is not saved in your verified account.'),{status:403});
  return{store,key:'team-plan:'+session.sub+':'+teamId,sub:session.sub};
}
function validate(state,teamId){
  if(!state||typeof state!=='object'||Array.isArray(state))throw Object.assign(Error('Invalid plan state.'),{status:400});
  const s=state.squad;if(s&&(!Array.isArray(s.squadIds)||s.squadIds.length!==15||new Set(s.squadIds).size!==15||s.squadIds.some(id=>!Number.isSafeInteger(id)||id<=0)||s.teamId!==teamId||!Number.isFinite(s.bank)||s.bank<0||s.bank>100))throw Object.assign(Error('Save a complete squad with a valid bank.'),{status:400});
  const p=state.preferences||{};
  if(p.freeTransfers!=null&&(!Number.isInteger(p.freeTransfers)||p.freeTransfers<0||p.freeTransfers>5))throw Object.assign(Error('Confirm 0–5 free transfers.'),{status:400});
  if(s){
    const subset=(ids,length)=>Array.isArray(ids)&&ids.length===length&&new Set(ids).size===length&&ids.every(id=>s.squadIds.includes(id));
    if(!subset(s.startingIds,11)||!subset(s.benchIds,4)||new Set([...s.startingIds,...s.benchIds]).size!==15||!s.startingIds.includes(s.captainId)||!s.startingIds.includes(s.viceCaptainId)||s.captainId===s.viceCaptainId)throw Object.assign(Error('Save a complete XI, bench and two different captains.'),{status:400});
  }
  if(p.bank!=null&&(!Number.isFinite(p.bank)||p.bank<0||p.bank>100))throw Object.assign(Error('Invalid confirmed bank.'),{status:400});
  const prices=state.sellingPrices||{};
  if(Array.isArray(prices)||Object.keys(prices).length>100||Object.entries(prices).some(([id,r])=>!/^\d+$/.test(id)||!r||!Number.isFinite(r.price)||r.price<=0||r.price>100))throw Object.assign(Error('Invalid selling prices.'),{status:400});
  if(Object.entries(state.chips||{}).some(([chip,gw])=>!['bb','fh','wc','tc'].includes(chip)||!Number.isInteger(gw)||gw<1||gw>38))throw Object.assign(Error('Invalid chip gameweek.'),{status:400});
  return {squad:s||null,preferences:p,sellingPrices:prices,chips:state.chips||{},draftGameweek:state.draftGameweek||null};
}
async function record(event,report,picks){
  if(Date.now()>=Date.parse(report.deadline))return{saved:false,reason:'Deadline passed'};
  let scoped;try{scoped=await scope(event,report.teamId);}catch(error){if([401,403].includes(error.status))return{saved:false,reason:error.message};throw error;}
  const {store,key}=scoped, old=await store.getWithMetadata(key+':journal',{type:'json'});
  const season=report.season||report.deadline.slice(0,4), rows=old?.data?.records||[];
  const existing=rows.find(r=>r.gameweek===report.gameweek&&r.season===season);
  if(existing)return{saved:true,firstRecordedAt:existing.createdAt,immutable:true};
  const move=report.recommendation;
  const base={squadIds:[...report.xi,...report.bench].map(p=>p.id),xi:report.xi.map(p=>p.id),captain:report.captains[0]?.id,vice:report.captains[1]?.id,hit:0};
  const chosen=move?{squadIds:[...move.xi,...move.bench].map(p=>p.id),xi:move.xi.map(p=>p.id),captain:move.captainId,vice:move.xi.filter(p=>p.id!==move.captainId).sort((a,b)=>b.xp-a.xp)[0]?.id,hit:move.hit}:base;
  const row={season,gameweek:report.gameweek,deadline:report.deadline,createdAt:new Date().toISOString(),model:report.model,forecast:move?move.forecast-move.hit:report.forecast,base,chosen,league:report.league?{id:report.league.id,rank:report.league.rank,gap:report.league.leader?.gap,total:report.league.total}:null};
  const changed=await store.setJSON(key+':journal',{records:[...rows,row].slice(-80)},old?{onlyIfMatch:old.etag}:{onlyIfNew:true});
  return{saved:changed.modified,immutable:true,reason:changed.modified?null:'Another report was recorded. Reload history.'};
}
module.exports={scope,validate,record};

const round = value => Math.round(value * 10) / 10;
function expected(player, fixtures, gw) {
  const games = fixtures.filter(f => f.event === gw && (f.team_h === player.team || f.team_a === player.team));
  if (!games.length || ['u', 'i', 's', 'n'].includes(player.status) || player.chance_of_playing_next_round === 0) return 0;
  const chance = player.chance_of_playing_next_round == null ? 1 : player.chance_of_playing_next_round / 100;
  const form = Number(player.form) || Number(player.points_per_game) || 0;
  const official = Number(player.ep_next);
  const fixtureForm = games.reduce((total, f) => total + form * ({ 1: 1.18, 2: 1.1, 3: 1, 4: 0.9, 5: 0.8 }[f.team_h === player.team ? f.team_h_difficulty : f.team_a_difficulty] || 1), 0);
  // ep_next already covers the next event, including double gameweeks: do not multiply it by fixture count.
  return Math.max(0, (Number.isFinite(official) ? 0.75 * official + 0.25 * fixtureForm : fixtureForm) * chance);
}
function bestLineup(squad, score) {
  const byPosition = {};
  for (const p of squad) (byPosition[p.element_type] ||= []).push(p);
  for (const list of Object.values(byPosition)) list.sort((a, b) => score(b) - score(a) || a.id - b.id);
  let best = null;
  for (let defenders = 3; defenders <= 5; defenders++) for (let forwards = 1; forwards <= 3; forwards++) {
    const midfielders = 10 - defenders - forwards;
    if (midfielders < 2 || midfielders > 5 || !(byPosition[1]?.length >= 1 && byPosition[2]?.length >= defenders && byPosition[3]?.length >= midfielders && byPosition[4]?.length >= forwards)) continue;
    const xi = [byPosition[1][0], ...byPosition[2].slice(0, defenders), ...byPosition[3].slice(0, midfielders), ...byPosition[4].slice(0, forwards)];
    const total = xi.reduce((sum, p) => sum + score(p), 0);
    if (!best || total > best.total) best = { xi, total, formation: `${defenders}-${midfielders}-${forwards}` };
  }
  if (!best) throw Object.assign(new Error('A complete legal 15-player squad is needed. Confirm your squad on Pick first.'), { status: 400 });
  return best;
}
function squadValid(squad) {
  if (squad.length !== 15 || new Set(squad.map(p => p.id)).size !== 15) return false;
  const counts = [0, 0, 0, 0, 0], clubs = {};
  for (const p of squad) { counts[p.element_type]++; clubs[p.team] = (clubs[p.team] || 0) + 1; }
  return counts[1] === 2 && counts[2] === 5 && counts[3] === 5 && counts[4] === 3 && Object.values(clubs).every(n => n <= 3);
}
function plan({ elements, fixtures, squadIds, gw, bank, freeTransfers = 0, sellingPrices = {}, fieldOwnership = {}, fieldSize = 0 }) {
  const squad = squadIds.map(id => elements.find(p => p.id === id)).filter(Boolean);
  if (!squadValid(squad)) throw Object.assign(new Error('Confirm a legal squad: 2 goalkeepers, 5 defenders, 5 midfielders, 3 forwards; at most 3 per club.'), { status: 400 });
  const scores=new Map(elements.map(p=>[p.id,expected(p,fixtures,gw)]));
  const score = p => scores.get(p.id) || 0;
  const horizonScores=new Map(elements.map(p=>[p.id,[0,1,2].reduce((total,offset)=>total+expected(offset?{...p,ep_next:undefined}:p,fixtures,gw+offset),0)]));
  const horizonScore = p => horizonScores.get(p.id) || 0;
  const horizonLineup = bestLineup(squad, horizonScore);
  const horizonBaseline = horizonLineup.total + Math.max(...horizonLineup.xi.map(horizonScore));
  const lineup = bestLineup(squad, score);
  const captains = [...lineup.xi].sort((a, b) => score(b) - score(a)).slice(0, 3);
  const describe = p => ({ id: p.id, name: p.web_name, position: p.element_type, team: p.team, price: p.now_cost / 10, xp: round(score(p)), chance: p.chance_of_playing_next_round, fixtures: fixtures.filter(f => f.event === gw && (f.team_h === p.team || f.team_a === p.team)).map(f => ({ home: f.team_h === p.team, opponent: f.team_h === p.team ? f.team_a : f.team_h, difficulty: f.team_h === p.team ? f.team_h_difficulty : f.team_a_difficulty })) });
  const options = [];
  const unknownPrices = [];
  const sale = p => sellingPrices[p.id];
  for(const p of squad) if(!Number.isFinite(sale(p))||sale(p)<=0||sale(p)>p.now_cost/10||Math.abs(Math.round(sale(p)*10)-sale(p)*10)>0.00001) unknownPrices.push(p.id);
  const baseline=lineup.total+score(captains[0]);
  const pools={};
  for(let position=1;position<=4;position++) {
    const pool=elements.filter(p=>p.element_type===position&&!squadIds.includes(p.id)&&score(p)>0&&(p.chance_of_playing_next_round==null||p.chance_of_playing_next_round>=75));
    pools[position]=[...new Map([...pool.sort((a,b)=>score(b)-score(a)).slice(0,12),...pool.sort((a,b)=>a.now_cost-b.now_cost).slice(0,4)].map(p=>[p.id,p])).values()];
  }
  let beam=[{squad,bank,moves:[],forecast:baseline}];
  for(let count=1;count<=Math.min(8,Math.max(1,freeTransfers+3));count++) {
    const expanded=new Map();
    for(const state of beam) for(const out of squad) {
      if(unknownPrices.includes(out.id)||state.moves.some(m=>m.out.id===out.id)) continue;
      for(const inn of pools[out.element_type]) {
        if(state.squad.some(p=>p.id===inn.id)||inn.now_cost/10>state.bank+sale(out)+0.001) continue;
        const nextSquad=state.squad.map(p=>p.id===out.id?inn:p);
        if(!squadValid(nextSquad))continue;
        const next=bestLineup(nextSquad,score),forecast=next.total+Math.max(...next.xi.map(score));
        const hit=4*Math.max(0,count-freeTransfers),gain=forecast-baseline-hit;
        const moves=[...state.moves,{out:describe(out),in:describe(inn),salePrice:sale(out)}];
        const nextBank=state.bank+sale(out)-inn.now_cost/10;
        const key=moves.map(m=>m.out.id+'>'+m.in.id).sort().join('|');
        if(expanded.has(key))continue;
        expanded.set(key,{squad:nextSquad,bank:nextBank,moves,forecast,net:gain});
        if(gain<=0.2)continue;
        const horizonNext=bestLineup(nextSquad,horizonScore);
        const gain3=horizonNext.total+Math.max(...horizonNext.xi.map(horizonScore))-horizonBaseline-hit;
        if(gain3<=0)continue;
        const ownership=moves.reduce((sum,m)=>sum+(fieldOwnership[m.in.id]||0),0)/count;
        options.push({moves,size:count,out:moves[0].out,in:moves[0].in,hit,gain:round(gain),gain3:round(gain3),bankAfter:round(nextBank),salePrice:moves[0].salePrice,fieldOwnership:ownership,differential:fieldSize>0&&ownership<0.5,forecast:round(forecast)});
      }
    }
    beam=[...expanded.values()].sort((a,b)=>b.net-a.net||b.bank-a.bank).slice(0,8);
    if(!beam.length)break;
  }
  options.sort((a, b) => b.gain - a.gain || a.size - b.size || a.in.price - b.in.price);
  const best = options[0] || null;
  const chase = fieldSize ? options.filter(o=>o.differential && o.gain >= (best?.gain||0)*0.85).sort((a,b)=>b.gain*(1-b.fieldOwnership)-a.gain*(1-a.fieldOwnership) || b.gain-a.gain)[0] || null : null;
  const recommendation = chase || best;
  const bench = squad.filter(p => !lineup.xi.includes(p)).sort((a, b) => (a.element_type === 1 ? -1 : b.element_type === 1 ? 1 : score(b) - score(a)));
  return { model: 'myfpl-transfer-packages-v3', recommendation, estimated: true, formation: lineup.formation, forecast: round(lineup.total + score(captains[0])), xi: lineup.xi.map(describe), bench: bench.map(describe), captains: captains.map(describe), hold: { gain: 0, hit: 0 }, steady: best, chase, unknownPrices, warnings: ['Experimental estimates, not guaranteed points. Late news and rotation can change the outcome.', ...(unknownPrices.length ? ['Transfer comparisons exclude players whose selling prices have not been confirmed.'] : [])] };
}
module.exports = { expected, bestLineup, squadValid, plan };

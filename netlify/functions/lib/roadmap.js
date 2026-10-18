const {plan}=require('./decision-engine');
function roadmap(input,events,history){
  let squadIds=[...input.squadIds],bank=input.bank,free=input.freeTransfers;
  let prices={...input.sellingPrices};const weeks=[];
  for(let offset=0;offset<6;offset++){
    const gw=input.gw+offset,event=events.find(e=>e.id===gw);if(!event)break;
    const elements=input.elements.map(p=>offset?{...p,ep_next:undefined}:p);
    const report=plan({...input,elements,squadIds,bank,freeTransfers:free,sellingPrices:prices,gw});
    const move=report.recommendation;
    const blanks=squadIds.filter(id=>!input.fixtures.some(f=>f.event===gw&&(f.team_h===elements.find(p=>p.id===id).team||f.team_a===elements.find(p=>p.id===id).team)));
    const doubles=squadIds.filter(id=>input.fixtures.filter(f=>f.event===gw&&(f.team_h===elements.find(p=>p.id===id).team||f.team_a===elements.find(p=>p.id===id).team)).length>1);
    const benchForecast=report.bench.reduce((sum,p)=>sum+p.xp,0),captain=move?move.xi.find(p=>p.id===move.captainId):report.captains[0];
    weeks.push({gameweek:gw,deadline:event.deadline_time,freeBefore:free,action:move?'Transfer package':'Hold',moves:move?.moves||[],hit:move?.hit||0,netGain:move?.gain||0,bankAfter:move?.bankAfter??bank,blankPlayers:blanks.length,doublePlayers:doubles.length,holdForecast:report.forecast,forecast:move?move.forecast-move.hit:report.forecast,benchForecast,captain,freeAfter:Math.min(5,Math.max(0,free-(move?.size||0))+1)});
    if(move){squadIds=move.squadIds;bank=move.bankAfter;for(const m of move.moves)prices[m.in.id]=m.in.price;}
    free=weeks.at(-1).freeAfter;
  }
  const choose=(chip,score)=>weeks.filter(w=>!(history?.chips||[]).some(c=>c.name===chip&&(c.event<=19?1:2)===(w.gameweek<=19?1:2))).sort((a,b)=>score(b)-score(a))[0];
  const tc=choose('3xc',w=>w.captain?.xp||0),bb=choose('bboost',w=>w.benchForecast),fh=choose('freehit',w=>w.blankPlayers),wc=choose('wildcard',w=>w.hit);
  return {weeks,chips:[tc&&{chip:'Triple Captain',gameweek:tc.gameweek,reason:'Highest forecast captain return in this window.'},bb&&{chip:'Bench Boost',gameweek:bb.gameweek,reason:'Strongest projected bench in this window.'},fh?.blankPlayers>=4&&{chip:'Free Hit',gameweek:fh.gameweek,reason:'At least four blanking players; review a temporary squad.'},wc?.hit>=8&&{chip:'Wildcard',gameweek:wc.gameweek,reason:'A simulated package costs at least eight points; review a full rebuild.'}].filter(Boolean),assumptions:['Six-week greedy scenario, not a globally optimal season plan.','Current prices and confirmed selling prices are held fixed; injuries and fixture dates may change.','One new free transfer per gameweek, capped at five. Chip suggestions are advisory and are not activated or included in the simulated transfer path.','Chip suggestions are alternatives; at most one chip can be played in any gameweek.',
'Chip availability uses published history for the current half-season; verify any unpublished activation and the GW19/GW20 reset on official FPL.']};
}
module.exports={roadmap};

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {expected,bestLineup,plan}=require('../netlify/functions/lib/decision-engine');
const {evidence}=require('../netlify/functions/lib/forecast');
const source=fs.readFileSync('js/app.js','utf8');
function fn(name){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+1);return source.slice(a,b<0?undefined:b);}
const squad=()=>Array.from({length:15},(_,i)=>({id:i+1,web_name:'P'+i,team:Math.floor(i/3)+1,element_type:i<2?1:i<7?2:i<12?3:4,now_cost:50,form:3,status:'a',ep_next:3}));
const fixtures=[7,8,9].flatMap(event=>Array.from({length:9},(_,i)=>({event,team_h:i+1,team_a:99,team_h_difficulty:3,team_a_difficulty:3})));
test('captain uses next gameweek rather than three-gameweek ranking',()=>{
 const c=vm.createContext({players:[{id:1,xp:9,xp3:15},{id:2,xp:4,xp3:25}],startingIds:[1,2],squad:[],xpOf:p=>p.xp3});vm.runInContext(fn('assignCaptainAndVice'),c);c.assignCaptainAndVice();assert.equal(vm.runInContext('captainId',c),1);
});
test('lineup maximises the XI plus captain, not just eleven-player sum',()=>{
 const s=squad();s.filter(p=>p.element_type===2).forEach(p=>p.v=5);s.filter(p=>p.element_type===3).forEach(p=>p.v=5);s.filter(p=>p.element_type===4).forEach(p=>p.v=1);s[12].v=10;s[13].v=4;s[14].v=4;
 const chosen=bestLineup(s,p=>p.v||2);assert(chosen.xi.some(p=>p.id===13));
});
test('null recent minutes fall back to season minutes rather than becoming zero',()=>{assert.equal(evidence({minutes:450,gamesPlayed:5,recentMinutes:null}).minutes,90);});
test('ownership never replaces the highest net-points default package',()=>{
 const s=squad(),elements=[...s,{...s[7],id:30,team:8,form:15,ep_next:15},{...s[7],id:31,team:9,form:14,ep_next:14}];
 const r=plan({elements,fixtures,squadIds:s.map(p=>p.id),gw:7,bank:0,freeTransfers:1,sellingPrices:Object.fromEntries(s.map(p=>[p.id,5])),fieldOwnership:{30:1,31:0},fieldSize:10});assert.equal(r.recommendation,r.steady);
});
test('small free-transfer edge is held, and paid transfers require a margin beyond the hit',()=>{
 const s=squad();for(const [xp,free,shouldMove] of [[3.3,1,false],[5.3,0,false],[12,0,true]]){
 const r=plan({elements:[...s,{...s[7],id:30,team:8,form:xp,ep_next:xp}],fixtures,squadIds:s.map(p=>p.id),gw:7,bank:0,freeTransfers:free,sellingPrices:Object.fromEntries(s.map(p=>[p.id,5]))});assert.equal(!!r.recommendation,shouldMove);if(r.recommendation)assert(r.recommendation.gain>r.recommendation.safetyMargin);
 }
});
test('lineup-only optimisation never recalculates the manager bank',()=>{assert(!fn('optimiseLineup').includes('bank ='));});
test('browser build executes the same server model for blanks, doubles, availability and history',()=>{
 const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('site/js/forecast-model.js','utf8'),c);
 for(const p of [{...squad()[0],gamesPlayed:6,minutes:540,expected_goals_per_90:0.1},{...squad()[8],gamesPlayed:6,minutes:80,expected_goals_per_90:0.5,status:'i'}])for(const gw of [7,12])assert.equal(c.window.MyFPLModel.expected(p,fixtures,gw),expected(p,fixtures,gw));
});

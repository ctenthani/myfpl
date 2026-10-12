const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
process.env.AUTH_SECRET='tests-only-long-secret-never-production';
const core=require('../netlify/functions/lib/account-core');
const source=fs.readFileSync('js/app.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end<0?undefined:end);}
const squad=Array.from({length:15},(_,i)=>({id:i+1,web_name:'P'+i,team_id:Math.floor(i/3)+1,position:i<2?'GKP':i<7?'DEF':i<12?'MID':'FWD',price:5,xp:i===1?1:5}));
function browser(confirmed=true){
 const storage=new Map(),status=[],input={value:'1'},bankInput={value:'0'};
 const ctx=vm.createContext({squad:structuredClone(squad),bank:0,squadLockedValue:true,startingIds:[],benchIds:[],captainId:1,viceCaptainId:3,window:{},Event:class {},document:{dispatchEvent(){},getElementById:id=>id==='missionFt'?input:id==='missionBank'?bankInput:null,querySelector:()=>({click(){}})},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},confirmedSellingPrice:()=>confirmed,getSellingPrice:p=>p.price,setStatus:t=>status.push(t),openTransferConfirmation:()=>status.push('confirm'),xpOf:p=>p.xp,transferXp:p=>p.xp,assignCaptainAndVice(){},saveSquadLocal:()=>true,renderPitch(){},renderPlayerList(){},currentTeamId:()=>1,planningGw:()=>7});
 vm.runInContext(fn('transferSquadForecast')+'\n'+fn('applyTransferSuggestion'),ctx);
 return {ctx,storage,status,input};
}
test('missing selling price opens in-place confirmation without changing squad',()=>{
 const h=browser(false);assert.equal(h.ctx.applyTransferSuggestion({moves:[{out:squad[2],inn:{...squad[2],id:99,team_id:6}}]}),false);assert.deepEqual(h.status,['confirm']);assert.equal(h.ctx.squad[2].id,3);
});
test('apply saves draft, changes squad and spends a free transfer',()=>{
 const h=browser();assert.equal(h.ctx.applyTransferSuggestion({moves:[{out:squad[2],inn:{...squad[2],id:99,team_id:6,xp:8}}]}),true);assert.equal(h.ctx.squad[2].id,99);assert.equal(h.ctx.startingIds.length,11);assert.equal(h.input.value,0);assert.equal(h.storage.get('fpl_draft_gw_1'),'7');
});
test('unaffordable or stale packages do not partially change the squad',()=>{
 for(const inn of [{...squad[2],id:99,price:6},{...squad[2],id:1}]){const h=browser();assert.equal(h.ctx.applyTransferSuggestion({moves:[{out:squad[2],inn}]}),false);assert.equal(h.ctx.squad[2].id,3);assert.equal(h.ctx.bank,0);}
});
test('reserve goalkeeper upgrades do not count as starting XI gains',()=>{
 const h=browser(),initial=h.ctx.transferSquadForecast(h.ctx.squad);h.ctx.squad[1].xp=2;assert.equal(h.ctx.transferSquadForecast(h.ctx.squad),initial);
});
test('application rechecks a four-point hit when no free transfers remain',()=>{
 const h=browser();h.input.value='0';
 assert.equal(h.ctx.applyTransferSuggestion({moves:[{out:squad[2],inn:{...squad[2],id:99,team_id:6,xp:6}}]}),false);
 assert.equal(h.ctx.squad[2].id,3);assert.match(h.status.at(-1),/points hit/);
});
test('unprofitable multi-transfer packages cannot be applied',()=>{
 const h=browser();assert.equal(h.ctx.applyTransferSuggestion({moves:[{out:squad[2],inn:{...squad[2],id:99}},{out:squad[3],inn:{...squad[3],id:100}}]}),false);assert.equal(h.ctx.squad[2].id,3);
});
test('a profitable two-transfer package spends two banked free transfers',()=>{
 const h=browser();h.input.value='2';const moves=[2,3].map((i,n)=>({out:squad[i],inn:{...squad[i],id:99+n,team_id:6,xp:10}}));
 assert.equal(h.ctx.applyTransferSuggestion({moves}),true);assert.equal(h.input.value,0);assert.equal(h.ctx.squad[2].id,99);assert.equal(h.ctx.squad[3].id,100);assert.match(h.status.at(-1),/no points hit/);
});
function accounts(owner){
 const email=owner?'owner@example.invalid':'customer@example.invalid',id=core.userId(email),data={email,teamId:1};let saved=null;
 const store={getWithMetadata:async()=>({data,etag:'a'}),setJSON:async(k,row,opt)=>{saved=row;assert.equal(opt.onlyIfMatch,'a');return{modified:true};}};
 const ctx=vm.createContext({exports:{},process:{env:{OWNER_EMAIL:'owner@example.invalid'}},Buffer,Date,require:n=>n==='./lib/account-core'?{...core,store:()=>store}:require(n)});
 vm.runInContext(fs.readFileSync('netlify/functions/account.js','utf8'),ctx);
 const call=teams=>ctx.exports.handler({httpMethod:'POST',headers:{cookie:'myfpl_session='+core.token(email,1)},body:JSON.stringify({action:'saveTeams',teams})});
 return {call,saved:()=>saved};
}
test('verified owner can save other teams; customer cannot grant themselves owner access',async()=>{
 const h=accounts(true);assert.equal((await h.call([{teamId:5195954,label:'Second team'}])).statusCode,200);assert.equal(h.saved().teamId,1);assert.equal(h.saved().teams[0].teamId,5195954);
 assert.equal((await accounts(false).call([{teamId:5195954}])).statusCode,403);
});
test('duplicate and invalid team IDs are rejected',async()=>{
 const h=accounts(true);assert.equal((await h.call([{teamId:1},{teamId:1}])).statusCode,400);assert.equal((await h.call([{teamId:-1}])).statusCode,400);assert.equal(h.saved(),null);
});
test('after launch only the verified owner can plan another Team ID',async()=>{
 const now=()=>core.LAUNCH+1000;
 for(const owner of [false,true]) {
  const email=owner?'owner@example.invalid':'customer@example.invalid';let calls=0;
  const store={get:async()=>({email,teamId:1})};
  const ctx=vm.createContext({exports:{},process:{env:{OWNER_EMAIL:'owner@example.invalid'}},Date:{now},Map,Number,AbortSignal,fetch:async()=>{calls++;return{ok:false};},require:n=>n==='./lib/account-core'?{...core,store:()=>store}:n==='./lib/paypal-core'?{entitlement:async()=>({plan:'ultra',until:core.LAUNCH+86400000})}:require('../netlify/functions/lib/decision-engine')});
  vm.runInContext(fs.readFileSync('netlify/functions/coach.js','utf8'),ctx);
  const response=await ctx.exports.handler({httpMethod:'POST',headers:{cookie:'myfpl_session='+core.token(email,1,core.LAUNCH)},body:JSON.stringify({teamId:5195954})});
  assert.equal(response.statusCode,owner?502:403);assert.equal(calls,owner?3:0);
 }
});

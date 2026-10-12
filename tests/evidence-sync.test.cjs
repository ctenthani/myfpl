const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
process.env.AUTH_SECRET='test-only-secret-long-enough-for-sessions';
const core=require('../netlify/functions/lib/account-core'),{evidence}=require('../netlify/functions/lib/forecast'),{roadmap}=require('../netlify/functions/lib/roadmap'),{realised}=require('../netlify/functions/lib/outcomes');
test('minutes and availability evidence are visible and rotation lowers the underlying forecast',()=>{
 const p={element_type:3,form:4,gamesPlayed:5,minutes:450,expected_goals_per_90:0.5,expected_assists_per_90:0.2};
 assert.ok(evidence({...p,recentMinutes:90}).estimate>evidence({...p,recentMinutes:20}).estimate);assert.equal(evidence({...p,recentMinutes:20}).confidence,'very low');
});
test('roadmap rolls free transfers to five and recognises the second chip set',()=>{
 const elements=Array.from({length:15},(_,i)=>({id:i+1,web_name:'P',team:Math.floor(i/3)+1,element_type:i<2?1:i<7?2:i<12?3:4,now_cost:50,form:3,status:'a'}));
 const fixtures=[19,20].flatMap(event=>Array.from({length:5},(_,i)=>({event,team_h:i+1,team_a:99,team_h_difficulty:3})));
 const result=roadmap({elements,fixtures,squadIds:elements.map(p=>p.id),gw:19,bank:0,freeTransfers:4,sellingPrices:{}},[{id:19,deadline_time:'2027-01-01'},{id:20,deadline_time:'2027-01-08'}],{chips:[{name:'3xc',event:7}]});
 assert.equal(result.weeks[0].freeAfter,5);assert.equal(result.weeks[1].freeAfter,5);assert.equal(result.chips.find(c=>c.chip==='Triple Captain').gameweek,20);
});
test('outcome replay substitutes goalkeeper and passes captaincy to playing vice',()=>{
 const selection={xi:[1,3,4,5,8,9,10,11,13,14,15],squadIds:Array.from({length:15},(_,i)=>i+1),captain:1,vice:8,hit:4};
 const positions=Object.fromEntries(selection.squadIds.map(i=>[i,i<3?1:i<8?2:i<13?3:4]));
 const actual=Object.fromEntries(selection.squadIds.map(i=>[i,{minutes:90,points:2}]));actual[1].minutes=0;actual[1].points=0;
 assert.equal(realised(selection,actual,positions),20);
});
function harness(fetcher){
 const rows=new Map(),copy=x=>x?structuredClone(x):null;let serial=0;
 const store={get:async k=>copy(rows.get(k)?.data),getWithMetadata:async k=>copy(rows.get(k)),setJSON:async(k,data,opt={})=>{const old=rows.get(k);if(opt.onlyIfNew&&old||opt.onlyIfMatch&&old?.etag!==opt.onlyIfMatch)return{modified:false};rows.set(k,{data:copy(data),etag:String(++serial)});return{modified:true};}};
 const email='owner@example.invalid',sub=core.userId(email);rows.set('user:'+sub,{data:{email,teamId:1,teams:[{teamId:2}]},etag:'account'});
 const scopedCore={...core,store:()=>store};
 const recordsContext=vm.createContext({exports:{},module:{exports:{}},require:()=>scopedCore,process:{env:{OWNER_EMAIL:email}},Date,Number,Set});vm.runInContext(fs.readFileSync('netlify/functions/lib/team-records.js','utf8'),recordsContext);const records=recordsContext.module.exports;
 const context=vm.createContext({exports:{},require:n=>n==='./lib/account-core'?scopedCore:n==='./lib/team-records'?records:{realised},Number,Date,AbortSignal,fetch:fetcher|| (async()=>{throw Error('Not used');})});vm.runInContext(fs.readFileSync('netlify/functions/plans.js','utf8'),context);
 const event=body=>({httpMethod:'POST',headers:{cookie:'myfpl_session='+core.token(email,1)},body:JSON.stringify(body)});
 return{call:b=>context.exports.handler(event(b)),records,event,rows,raw:context.exports.handler};
}
test('cloud plans isolate teams and reject stale or concurrent revisions',async()=>{
 const h=harness(),state={preferences:{freeTransfers:2},sellingPrices:{},chips:{}};
 assert.equal((await h.call({action:'save',teamId:1,revision:0,state})).statusCode,200);
 assert.equal((await h.call({action:'save',teamId:1,revision:0,state})).statusCode,409);
 assert.equal(JSON.parse((await h.call({action:'load',teamId:2})).body).state,null);
 assert.equal((await h.call({action:'load',teamId:3})).statusCode,403);
 const concurrent=await Promise.all([h.call({action:'save',teamId:1,revision:1,state}),h.call({action:'save',teamId:1,revision:1,state})]);assert.deepEqual(concurrent.map(x=>x.statusCode).sort(),[200,409]);
});
test('first pre-deadline report is immutable and late records are refused',async()=>{
 const h=harness(),future=new Date(Date.now()+3600000).toISOString(),players=Array.from({length:15},(_,i)=>({id:i+1}));
 const report={teamId:1,gameweek:7,deadline:future,model:'test',forecast:50,xi:players.slice(0,11),bench:players.slice(11),captains:[players[0],players[1]],recommendation:null};
 assert.equal((await h.records.record(h.event({}),report,players.map(p=>p.id))).saved,true);
 assert.equal((await h.records.record(h.event({}),{...report,forecast:999},[])).saved,true);
 const journal=[...h.rows.values()].find(r=>r.data.records);assert.equal(journal.data.records[0].forecast,50);
 assert.equal((await h.records.record(h.event({}),{...report,gameweek:8,deadline:'2000-01-01'},[])).saved,false);
});

test('private plans reject anonymous requests and invalid squad, price and chip states',async()=>{
 const h=harness();
 assert.equal((await h.raw({httpMethod:'POST',headers:{},body:JSON.stringify({action:'load',teamId:1})})).statusCode,401);
 for(const state of [{sellingPrices:{1:null}},{chips:{tc:39}},{preferences:{bank:-1}},{squad:{teamId:1,squadIds:Array.from({length:15},(_,i)=>i+1),bank:0,startingIds:[1],benchIds:[]}}])assert.equal((await h.call({action:'save',teamId:1,revision:0,state})).statusCode,400);
});
test('January journals retain season identity and score only final checked gameweeks',async()=>{
 const positions=Array.from({length:15},(_,i)=>({id:i+1,element_type:i<2?1:i<7?2:i<12?3:4}));
 const boot={elements:positions,events:[{id:1,deadline_time:'2026-08-01'},{id:20,finished:true,data_checked:true},{id:21,finished:true,data_checked:false}]};
 const h=harness(async url=>({ok:true,json:async()=>url.includes('bootstrap')?boot:url.includes('/history/')?{current:[{event:20,points:60,event_transfers_cost:4}]}:{elements:positions.map(p=>({id:p.id,stats:{minutes:90,total_points:2}}))}}));
 const xi=[1,3,4,5,8,9,10,11,13,14,15],selection={xi,squadIds:[...xi,2,6,7,12],captain:8,vice:9,hit:4};
 const key='team-plan:'+core.userId('owner@example.invalid')+':1:journal';
 h.rows.set(key,{data:{records:[20,21].map(gameweek=>({season:'2026',gameweek,deadline:'2027-01-02',createdAt:'2026-12-31',chosen:selection,base:{...selection,hit:0},forecast:30}))},etag:'journal'});
 const result=JSON.parse((await h.call({action:'history',teamId:1})).body);
 assert.equal(result.records[0].recommendedPoints,20);assert.equal(result.records[0].difference,-4);assert.equal(result.records[0].managerPoints,56);
 assert.equal(result.records[1].recommendedPoints,undefined);
 const players=positions.map(p=>({id:p.id}));
 await h.records.record(h.event({}),{season:'2026',teamId:1,gameweek:22,deadline:'2027-01-30',model:'test',forecast:50,xi:players.slice(0,11),bench:players.slice(11),captains:players.slice(0,2)},[]);
 assert.equal(h.rows.get(key).data.records.at(-1).season,'2026');
});

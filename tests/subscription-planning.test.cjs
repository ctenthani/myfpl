const {test}=require('node:test');
const assert=require('node:assert/strict');
process.env.AUTH_SECRET='test-only-secret-that-is-long-enough';
process.env.PAYPAL_PRO_PLAN_ID='P-PRO';process.env.PAYPAL_ULTRA_PLAN_ID='P-ULTRA';
const core=require('../netlify/functions/lib/account-core');
const {paidAccess,entitlement}=require('../netlify/functions/lib/paypal-core');
const {expected,plan}=require('../netlify/functions/lib/decision-engine');
test('signed sessions reject forged, expired and modified cookies',()=>{
 const now=Date.now(), email='test@example.invalid'; const value=core.token(email,1,now);
 const event=v=>({headers:{cookie:'myfpl_session='+v}});
 assert.equal(core.session(event(value),now).email,email);
 assert.equal(core.session(event(value+'x'),now),null);
 assert.equal(core.session(event(value),now+8*86400000),null);
 const parts=value.split('.');parts[0]=Buffer.from(JSON.stringify({email,sub:core.userId(email),teamId:99,exp:now+86400000})).toString('base64url');
 assert.equal(core.session(event(parts.join('.')),now),null);
});
const subscription=(status='ACTIVE')=>({id:'I-TEST',plan_id:'P-PRO',custom_id:'user',status,billing_info:{last_payment:{time:'2027-01-31T12:00:00Z',amount:{currency_code:'USD',value:'2.49'}}}});
test('a completed verified monthly payment grants access only to its account',()=>{
 const now=Date.parse('2027-02-01T00:00:00Z');
 assert.equal(paidAccess(subscription(),'user',0,now).until,Date.parse('2027-02-28T12:00:00Z'));
 assert.equal(paidAccess(subscription(),'other',0,now).plan,'starter');
 assert.equal(paidAccess({...subscription(),billing_info:{}},'user',0,now).plan,'starter');
});
test('cancellation retains paid period; expiry, refund and suspension revoke access',()=>{
 const now=Date.parse('2027-02-01T00:00:00Z');
 assert.equal(paidAccess(subscription('CANCELLED'),'user',0,now).plan,'pro');
 assert.equal(paidAccess(subscription('SUSPENDED'),'user',0,now).plan,'starter');
 assert.equal(paidAccess(subscription(),'user',now-1,now).plan,'starter');
 assert.equal(paidAccess(subscription(),'user',0,Date.parse('2027-03-01')).plan,'starter');
});
test('an expired cached entitlement cannot extend a paid period',async()=>{
 const access=await entitlement('user',{getWithMetadata:async()=>({etag:'one',data:{id:'I-TEST',checkedAt:Date.now(),access:{plan:'ultra',until:Date.now()-1}}})});
 assert.equal(access.plan,'starter');
});
test('blank and unavailable players score zero; double weeks do not duplicate ep_next',()=>{
 const p={team:1,form:'4',ep_next:'8',status:'a',chance_of_playing_next_round:null};
 const f={event:7,team_h:1,team_a:2,team_h_difficulty:3};
 assert.equal(expected(p,[],7),0);assert.equal(expected({...p,chance_of_playing_next_round:0},[f],7),0);
 assert.equal(expected(p,[f,{...f,team_a:3}],7),8);
});
const squad=Array.from({length:15},(_,i)=>({id:i+1,web_name:'P'+i,team:Math.floor(i/3)+1,element_type:i<2?1:i<7?2:i<12?3:4,now_cost:50,form:'3',ep_next:'3',status:'a',chance_of_playing_next_round:100}));
const fixtures=Array.from({length:6},(_,i)=>({event:7,team_h:i+1,team_a:20,team_h_difficulty:3,team_a_difficulty:3}));
const args={elements:squad,fixtures,squadIds:squad.map(p=>p.id),gw:7,bank:0,freeTransfers:1};
test('weekly report enforces legal formation and requires selling prices',()=>{
 const result=plan(args); assert.equal(result.xi.length,11);assert.equal(result.bench.length,4);assert.equal(result.unknownPrices.length,15);assert.equal(result.steady,null);assert.equal(result.chase,null);
 assert.throws(()=>plan({...args,squadIds:Array(15).fill(1)}),/legal squad/);
});
test('a points hit is rejected when captain and XI gain does not cover the deduction',()=>{
 const incoming={...squad[12],id:99,team:6,ep_next:'5',form:'5'};
 const result=plan({...args,elements:[...squad,incoming],freeTransfers:0,sellingPrices:{13:5}});
 assert.equal(result.steady,null);
 const free=plan({...args,elements:[...squad,incoming],sellingPrices:{13:5}});
 assert.equal(free.steady.in.id,99);assert.equal(free.steady.gain,4);assert.equal(free.chase,null);
 const unavailable=plan({...args,elements:[...squad,{...incoming,chance_of_playing_next_round:0}],sellingPrices:{13:5}});assert.equal(unavailable.steady,null);
});
test('browser promotion cannot authorize paid server reports after launch',async()=>{
 const original=Date.now;Date.now=()=>core.LAUNCH+1000;
 try{const response=await require('../netlify/functions/coach').handler({httpMethod:'POST',headers:{},body:JSON.stringify({teamId:1,plan:'ultra',paid:true})});assert.equal(response.statusCode,401);}finally{Date.now=original;}
});
test('guest account and billing status remain usable without store credentials',async()=>{
 const event={httpMethod:'GET',headers:{}};
 assert.equal(JSON.parse((await require('../netlify/functions/account').handler(event)).body).signedIn,false);
 assert.equal(JSON.parse((await require('../netlify/functions/billing').handler(event)).body).open,false);
});

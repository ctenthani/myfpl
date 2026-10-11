const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
process.env.AUTH_SECRET='unit-test-secret-not-a-production-credential';
const actual=require('../netlify/functions/lib/account-core');
function harness(){
 const rows=new Map();let serial=0,lastCode;
 const copy=x=>x?structuredClone(x):null;
 const store={get:async k=>copy(rows.get(k)?.data),getWithMetadata:async k=>copy(rows.get(k)),setJSON:async(k,data,opt={})=>{const old=rows.get(k);if(opt.onlyIfNew&&old||opt.onlyIfMatch&&old?.etag!==opt.onlyIfMatch)return{modified:false};const etag=String(++serial);rows.set(k,{data:copy(data),etag});return{modified:true,etag};}};
 const context=vm.createContext({exports:{},process:{env:{RESEND_API_KEY:'fake',FROM_EMAIL:'test@example.invalid'}},Buffer,AbortSignal,Date,fetch:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');lastCode=JSON.parse(options.body).text.match(/code is (\d{6})/)[1];return{ok:true};},require:name=>name==='./lib/account-core'?{...actual,store:()=>store}:require(name)});
 vm.runInContext(fs.readFileSync('netlify/functions/account.js','utf8'),context);
 const call=body=>context.exports.handler({httpMethod:'POST',headers:{'x-nf-client-connection-ip':'test-only-address'},body:JSON.stringify(body)});
 return{call,code:()=>lastCode};
}
test('email verification is single use and grants a signed secure session',async()=>{
 const h=harness(),request=await h.call({action:'request',email:'example@example.invalid',teamId:1});assert.equal(request.statusCode,200);
 const input={action:'verify',challenge:JSON.parse(request.body).challenge,code:h.code()};
 const verified=await h.call(input);assert.equal(verified.statusCode,200);assert.match(verified.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax/);
 assert.equal((await h.call(input)).statusCode,401);
});
test('five wrong codes exhaust a challenge without granting access',async()=>{
 const h=harness(),r=await h.call({action:'request',email:'example@example.invalid',teamId:1});const challenge=JSON.parse(r.body).challenge;
 const wrong=h.code()==='000000'?'111111':'000000';for(let i=0;i<5;i++)assert.equal((await h.call({action:'verify',challenge,code:wrong})).statusCode,401);
 assert.equal((await h.call({action:'verify',challenge,code:h.code()})).statusCode,401);
});
test('simultaneous verification cannot reuse the same code',async()=>{
 const h=harness(),r=await h.call({action:'request',email:'example@example.invalid',teamId:1});const input={action:'verify',challenge:JSON.parse(r.body).challenge,code:h.code()};
 const results=await Promise.all([h.call(input),h.call(input)]);assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
});
test('email delivery requests are rate limited',async()=>{
 const h=harness(),input={action:'request',email:'example@example.invalid',teamId:1};assert.equal((await h.call(input)).statusCode,200);assert.equal((await h.call(input)).statusCode,429);
});

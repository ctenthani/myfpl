const {test}=require('node:test');
const assert=require('node:assert/strict');
const {leagueContext}=require('../netlify/functions/coach');
test('league context includes managers above and below across all standings pages',async()=>{
 const paths=[];
 const get=async path=>{paths.push(path);if(path.includes('page_standings=1'))return{league:{name:'Test league'},standings:{has_next:true,results:[{entry:1,rank:1,total:100},{entry:2,rank:2,total:90}]}};if(path.includes('page_standings=2'))return{standings:{has_next:false,results:[{entry:3,rank:3,total:80}]}};return{picks:path.includes('entry/1/')?[{element:10,is_captain:true}]:[{element:20,is_captain:true}]};};
 const context=await leagueContext({leagues:{classic:[{id:9,name:'Test league',entry_rank:2}]}},2,9,1,6,get);
 assert.equal(context.analysed,2);assert.equal(context.complete,true);assert.equal(context.ownership[10],0.5);assert.equal(context.ownership[20],0.5);assert.equal(context.leader.gap,10);assert.equal(context.rival,undefined);assert.ok(paths.some(p=>p.includes('entry/3/')));
});
test('missing published squads are disclosed as incomplete coverage',async()=>{
 const get=async path=>{if(path.includes('standings'))return{standings:{has_next:false,results:[{entry:1,total:100,rank:1},{entry:2,total:90,rank:2}]}};throw Error('Not published');};
 const context=await leagueContext({leagues:{classic:[{id:9,name:'Test',entry_rank:2}]}},2,9,null,6,get);assert.equal(context.complete,false);assert.equal(context.analysed,0);assert.match(context.warning,/sample/);
});

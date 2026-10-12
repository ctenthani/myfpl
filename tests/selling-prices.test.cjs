const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reconstruct}=require('../netlify/functions/lib/selling-prices');
const base={elements:[{id:1,now_cost:54,cost_change_start:4},{id:2,now_cost:53,cost_change_start:3},{id:3,now_cost:47,cost_change_start:-3}],initialPicks:[{element:1},{element:2},{element:3}],currentPicks:[{element:1},{element:2},{element:3}],transfers:[],publishedGameweek:6};
test('initial season prices produce half-profit rounded down and full losses',()=>{
 const r=reconstruct(base);assert.equal(r.prices[1].price,5.2);assert.equal(r.prices[2].price,5.1);assert.equal(r.prices[3].price,4.7);assert.deepEqual(r.missing,[]);
});
test('buy-sell-rebuy uses latest acquisition cost rather than season starting price',()=>{
 const transfers=[{element_out:1,element_in:4,element_in_cost:40,event:2,time:'2026-08-20'},{element_out:4,element_in:1,element_in_cost:52,event:4,time:'2026-09-20'}];
 const r=reconstruct({...base,transfers:transfers.reverse()});assert.equal(r.prices[1].purchasePrice,5.2);assert.equal(r.prices[1].price,5.3);
});
test('Free Hit transfers do not change permanent acquisition costs',()=>{
 const r=reconstruct({...base,chips:[{name:'freehit',event:3}],transfers:[{element_out:1,element_in:4,element_in_cost:40,event:3,time:'2026-09-01'}]});assert.equal(r.prices[1].price,5.2);
 const temporary=reconstruct({...base,chips:[{name:'freehit',event:6}]});assert.deepEqual(temporary.prices,{});assert.equal(temporary.missing.length,3);
});
test('unpublished transfers and unknown purchases cannot create guessed selling prices',()=>{
 const r=reconstruct({...base,transfers:[{element_out:1,element_in:9,element_in_cost:50,event:7,time:'2026-10-15'}],currentPicks:[{element:1},{element:9}]});assert.equal(r.prices[1].price,5.2);assert.deepEqual(r.missing,[9]);
 const noInitial=reconstruct({...base,initialPicks:[]});assert.deepEqual(noInitial.prices,{});
});

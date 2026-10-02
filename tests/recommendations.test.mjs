import assert from 'node:assert/strict';
import {recommend} from '../recommendations.mjs';
const now=Date.now(),H=3600000;
function data(price=8500,id='1'){return {events:[],rows:[{game:'fc27',platform:'pc',card_id:id,name:'Test',market_price:price,updated_at:new Date(now).toISOString()}],averages:Array.from({length:7},(_,i)=>({game:'fc27',platform:'pc',card_id:id,interval_kind:'hourly',observed_at:new Date(now-(7-i)*H).toISOString(),price:10000}))};}
let r=recommend(data(),{now});assert.equal(r.picks.length,1);let p=r.picks[0];assert.equal(p.actionable,true);assert.equal(p.sell,9700);assert.equal(p.maxBuy,8500);assert.equal(p.profit,715);assert.equal(p.copies,2);assert.equal(p.profit,Math.floor(p.sell*.95)-p.entry);
r=recommend(data(10000),{now});assert.equal(r.picks[0].actionable,false);assert.equal(r.picks[0].entry,r.picks[0].maxBuy);
const stale=data();stale.rows[0].updated_at=new Date(now-H).toISOString();assert.equal(recommend(stale,{now}).picks.length,0);
const falling=data();falling.averages.forEach((p,i)=>p.price=10000-i*500);assert.equal(recommend(falling,{now}).picks.length,0);
assert.equal(recommend({...data(),averages:[]},{now}).picks.length,0);
assert.equal(recommend(data(580000),{now}).picks.length,0);
assert.equal(recommend(data(),{now,budget:200000,reserve:190000}).picks[0].copies,1);
const multi={rows:[],averages:[],events:[]};for(let i=0;i<10;i++){const d=data(8500,String(i));multi.rows.push(...d.rows);multi.averages.push(...d.averages);}r=recommend(multi,{now});assert.ok(r.remaining>=0);assert.ok(r.picks.reduce((n,p)=>n+p.copies*p.entry,0)<=100000);
assert.throws(()=>recommend(data(),{reserve:300000}));
console.log('Recommendation tax, bid targets, freshness, falling prices and allocation passed.');

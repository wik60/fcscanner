import assert from 'node:assert/strict';
import {rank,parseCSV,normalizeApify} from '../engine.mjs';
const now=Date.now(),card={game:'fc27',platform:'pc',card_id:'1',name:'Test',version:'Gold',buy_price:4000,market_price:5000,price_1h_ago:5000,samples:10,updated_at:new Date(now).toISOString()};
const result=rank([card],{now});assert.equal(result.picks[0].profit,560);assert.equal(result.picks[0].maxBuy,4000);
assert.equal(rank([{...card,platform:'ps'}],{now}).picks.length,0);
assert.equal(rank([{...card,updated_at:new Date(now-3600000).toISOString()}],{now}).picks.length,0);
assert.equal(rank([{...card,buy_price:4800}],{now}).picks[0].copies,0);
assert.equal(rank([{...card,buy_price:''}],{now}).picks.length,0);
const many=rank(Array.from({length:20},(_,i)=>({...card,card_id:String(i)})),{now});assert.ok(many.picks.reduce((sum,p)=>sum+p.copies*p.buy,0)<=100000);
assert.throws(()=>rank([card],{budget:200000,reserve:200001}));
const csv='game,platform,card_id,name,buy_price,market_price,price_1h_ago,samples,updated_at\r\nfc27,pc,1,"Test, name",4000,5000,5000,10,2026-10-02T00:00:00Z\r\n';assert.equal(parseCSV(csv)[0].name,'Test, name');
console.log('Browser engine checks passed.');

const raw={url:'https://www.futbin.com/27/player/123/example',playerName:'Example',prices:{pc:{lowestPrice:5000},console:{lowestPrice:3000}},scrapedAt:new Date(now).toISOString()};
const normalized=normalizeApify([raw]);assert.equal(normalized[0].market_price,5000);
const ap=rank(normalized,{now});assert.equal(ap.picks[0].maxBuy,4000);assert.equal(ap.picks[0].actionable,false);assert.equal(ap.picks[0].copies,0);assert.equal(ap.picks[0].profit,560);
assert.equal(rank(normalizeApify([{...raw,prices:{console:{lowestPrice:3000}}}]),{now}).picks.length,0);
assert.equal(rank(normalizeApify([{...raw,url:'https://www.futbin.com/26/player/123/example'}]),{now}).picks.length,0);
console.log('Apify schema import checks passed; no live Actor run tested.');

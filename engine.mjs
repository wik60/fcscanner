export function floorPrice(value) {
  value=Math.floor(value);
  const step=value<1000?50:value<10000?100:value<50000?250:value<100000?500:1000;
  return Math.floor(value/step)*step;
}
export function rank(rows, {budget=200000,reserve=100000,minProfit=500,minRoi=.08,maxAge=30,tax=.05,haircut=.03,now=Date.now()}={}) {
  if (![budget,reserve,minProfit,minRoi,maxAge,tax,haircut,now].every(Number.isFinite) || budget<0 || reserve<0 || reserve>budget || minProfit<0 || minRoi<0 || maxAge<=0 || tax<0 || tax>=1 || haircut<0 || haircut>=1) throw new Error('Check budget, reserve and thresholds.');
  if(!Array.isArray(rows) || rows.some(r=>!r||typeof r!=='object'||Array.isArray(r))) throw new Error('Input must be an array of card observations.');
  const picks=[],rejected=[],seen=new Set(),position=Math.min(budget-reserve,budget*.1);
  for(const r of rows) {
    try {
      const fail=m=>{throw new Error(m)};
      const num=k=>{if(r[k]===undefined||r[k]===null||String(r[k]).trim()==='') fail(`Missing ${k}`);const n=Number(r[k]);if(!Number.isFinite(n)||n<0)fail(`Invalid ${k}`);return n};
      if(String(r.game).toLowerCase()!=='fc27')fail('Not FC27');
      if(String(r.platform).toLowerCase()!=='pc')fail('Not PC prices');
      const id=String(r.card_id??'').trim();if(!id||seen.has(id))fail('Missing or duplicate card ID');seen.add(id);
      if(!/(Z|[+-]\d{2}:\d{2})$/i.test(String(r.updated_at)))fail('Timestamp needs a timezone');
      const stamp=Date.parse(r.updated_at),age=(now-stamp)/60000;
      if(!Number.isFinite(age)||age< -1||age>maxAge)fail('Stale or future-dated prices');
      const reference=r.data_kind==='reference';
      const market=num('market_price');
      const buy=reference?market:num('buy_price'),prior=reference?market:num('price_1h_ago'),samples=reference?null:num('samples');
      if(Math.min(buy,market,prior)<150)fail('Missing market price (zero) or price below 150');
      if(reference&&market>position)fail('Reference price exceeds your per-card budget');
      if(!reference&&floorPrice(buy)!==buy)fail('Invalid buy-price increment');
      if(!reference&&samples<3)fail('Need at least 3 comparable listings');
      const trend=market/prior-1;if(trend< -.05)fail('Price dropped more than 5% in one hour');
      const sell=floorPrice(market*(1-haircut)),net=Math.floor(sell*(1-tax));
      const maxBuy=floorPrice(Math.min(net-minProfit,net/(1+minRoi),position));
      if(maxBuy<150)fail('No affordable target');
      const profit=net-(reference?maxBuy:buy),roi=profit/(reference?maxBuy:buy),actionable=!reference&&buy<=maxBuy;
      const score=(actionable?roi:(net-maxBuy)/maxBuy)*(reference?.25:Math.min(samples/10,1))*Math.max(.2,1-Math.max(age,0)/maxAge);
      picks.push({name:String(r.name??id),version:String(r.version??''),id,buy,maxBuy,sell,profit,roi,age,trend,actionable,reference,source_url:r.source_url,score,copies:actionable?Math.min(3,Math.floor(position/buy)):0});
    } catch(e) { rejected.push({name:String(r?.name??'(unnamed)'),reason:e.message}); }
  }
  picks.sort((a,b)=>Number(b.actionable)-Number(a.actionable)||b.score-a.score);
  let remaining=budget-reserve;
  for(const p of picks){p.copies=Math.min(p.copies,Math.floor(remaining/p.buy));remaining-=p.copies*p.buy;}
  return {picks,rejected,remaining};
}
export function parseCSV(text) {
  const table=[]; let row=[],value='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(value.trim());value='';if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(Boolean))table.push(row);row=[];}}
    else value+=c;
  }
  if(quoted)throw new Error('CSV contains an unclosed quote.');
  if(value||row.length){row.push(value.trim());if(row.some(Boolean))table.push(row);}
  const headers=table.shift();if(!headers)throw new Error('Empty CSV.');
  const required=['game','platform','card_id','name','buy_price','market_price','price_1h_ago','samples','updated_at'];
  if(required.some(k=>!headers.includes(k)))throw new Error('CSV is missing required columns. See the README.');
  return table.map(values=>{if(values.length!==headers.length)throw new Error('CSV row has an incorrect number of columns.');return Object.fromEntries(headers.map((k,i)=>[k,values[i]]));});
}

// Verified against the Actor's documented output schema; not a live-run verification.
export function normalizeApify(data) {
  if(!Array.isArray(data)) throw new Error('Apify export must be a JSON array.');
  return data.map(r=>{
    const url=String(r.url??'');
    const match=url.match(/^https:\/\/(?:www\.)?futbin\.com\/(\d+)\/player\/(\d+)(?:\/|$)/);
    const pc=r.prices?.pc?.lowestPrice;
    // Keep invalid entries for transparent filtering. Never fall back to console prices.
    return {game:match?.[1]==='27'?'fc27':'unsupported',platform:'pc',card_id:match?.[2]??url,
      name:String(r.playerName??'Unknown player'),version:String(r.version??r.rarity??'Card '+(match?.[2]??'unknown')),
      data_kind:'reference',market_price:pc,updated_at:r.scrapedAt,source_url:match?url:undefined};
  });
}
export function normalizeInput(data) {
  if(Array.isArray(data)&&data.some(r=>r&&('playerName' in r||'prices' in r)))return normalizeApify(data);
  return data;
}

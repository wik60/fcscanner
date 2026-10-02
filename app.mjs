import {rank,parseCSV} from './engine.mjs';
const $=id=>document.getElementById(id),fmt=n=>Math.round(n).toLocaleString('en-GB');
let rows=[],demo=false,origin='No price data connected',latest=null;
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function options(){return {budget:Number($('budget').value),reserve:Number($('reserve').value),minProfit:Number($('minProfit').value),minRoi:Number($('minRoi').value)/100};}
function cell(tr,value){const td=document.createElement('td');td.textContent=value;tr.append(td);return td;}
function render(){
 try{
  const o=options(),result=rank(rows,o);latest=result;
  $('allocation').textContent=fmt(o.budget-o.reserve);$('count').textContent=result.picks.filter(p=>p.actionable).length;
  $('spend').textContent=fmt(o.budget-o.reserve-result.remaining);
  $('mode').textContent=demo?'FICTIONAL DEMO — not live recommendations':origin;
  $('source').textContent=rows.length?`${rows.length} observations · freshness checked ${new Date().toLocaleTimeString()} · PC only`:'Import fresh PC observations to find your buy limits.';
  $('picks').replaceChildren();
  for(const p of result.picks){const tr=document.createElement('tr'),name=cell(tr,p.name),sub=document.createElement('small');sub.textContent=p.version;name.append(sub);const action=cell(tr,''),tag=document.createElement('span');tag.className='tag'+(p.actionable?'':' wait');tag.textContent=p.actionable?'Buy candidate':'Bid target';action.append(tag);cell(tr,fmt(p.maxBuy));cell(tr,fmt(p.sell));cell(tr,fmt(p.profit));cell(tr,`${(p.roi*100).toFixed(1)}%`);cell(tr,p.copies);tr.title=`Observed buy ${fmt(p.buy)} · Price age ${p.age.toFixed(1)} min`; $('picks').append(tr);}
  $('tableWrap').hidden=!result.picks.length;$('empty').hidden=Boolean(result.picks.length);
  $('empty').querySelector('h3').textContent=rows.length?'No eligible cards in this snapshot.':'Start with cards you know.';
  $('rejected').replaceChildren();for(const r of result.rejected){const li=document.createElement('li');li.textContent=`${r.name}: ${r.reason}`;$('rejected').append(li);}
  $('filteredCount').textContent=result.rejected.length;$('export').disabled=!result.picks.length;
 }catch(e){latest=null;$('picks').replaceChildren();$('tableWrap').hidden=true;$('export').disabled=true;message(e.message,true);}
}
function setData(data,label,isDemo=false){rank(data,options());rows=data;demo=isDemo;origin=label;message('');render();}
$('settings').addEventListener('submit',e=>{e.preventDefault();message('');render();});
$('demo').addEventListener('click',async()=>{try{const r=await fetch('./sample.json');if(!r.ok)throw new Error('Cannot load demo.');const sample=await r.json();sample.forEach(row=>row.updated_at=new Date().toISOString());setData(sample,'Fictional sample',true);}catch(e){message(e.message,true);}});
$('file').addEventListener('change',async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5000000)throw new Error('Maximum file size is 5 MB.');const text=await f.text();setData(f.name.toLowerCase().endsWith('.csv')?parseCSV(text):JSON.parse(text),`Imported file: ${f.name}`);}catch(e){message(e.message,true);}finally{e.target.value='';}});
$('feedForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;message('Fetching prices…');try{const url=new URL($('feedUrl').value);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use a public HTTPS feed without credentials.');const r=await fetch(url.href,{signal:AbortSignal.timeout(20000),credentials:'omit'});if(!r.ok)throw new Error(`Feed returned HTTP ${r.status}.`);const text=await r.text();if(text.length>5000000)throw new Error('Feed too large.');setData(JSON.parse(text),`Feed snapshot: ${url.hostname}`);}catch(e){message(`Cannot fetch prices: ${e.message}. The feed must support browser access and the expected schema.`,true);}finally{button.disabled=false;}});
$('cardForm').addEventListener('submit',e=>{e.preventDefault();try{const observation=Object.fromEntries(new FormData(e.target));const id=`manual:${observation.name.toLowerCase()}:${observation.version.toLowerCase()}`;const item={...observation,card_id:id,game:'fc27',platform:'pc',updated_at:new Date().toISOString()};const next=demo?[item]:[...rows.filter(r=>r.card_id!==id),item];setData(next,'Your PC observations');e.target.reset();message('Observation added. Buy limits are estimates; check the current market.');}catch(e){message(e.message,true);}});
$('export').addEventListener('click',()=>{if(!latest)return;const blob=new Blob([JSON.stringify({demo,source:origin,generated_at:new Date().toISOString(),...latest},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=demo?'fictional-demo-picks.json':'pc-watchlist.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
setInterval(render,60000);render();

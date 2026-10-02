const $=id=>document.getElementById(id);let current=null;
async function rows(){const x=await chrome.storage.local.get('observations');return x.observations||[];}
async function count(){$('count').textContent='Zapisanych odczytów: '+(await rows()).length;}
$('read').onclick=async()=>{current=null;$('confirm').hidden=true;try{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(!/^https:\/\/(?:www\.)?futbin\.com\/27\/player\/\d+(?:\/|$)/.test(tab.url||''))throw Error('Otwórz stronę konkretnej karty FC27 na FUTBIN.');
 const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
 const match=location.pathname.match(/^\/27\/player\/(\d+)(?:\/|$)/);
 const visible=e=>!!(e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
 const texts=[...document.querySelectorAll('.platform-pc-only .lowest-price-1')].filter(visible).map(e=>e.textContent.trim());
 return {id:match?.[1],url:location.href,name:document.title.replace(/\s*[-|].*$/,'').replace(/ EA FC 27.*$/i,''),texts};
 }});
 current=result[0]?.result;if(!current?.id)throw Error('Nie udało się odczytać ID karty.');
 const parse=t=>{const s=t.replace(/[,\s]/g,'').toUpperCase();if(!/^\d+(?:\.\d+)?[KM]?$/.test(s))return null;const n=parseFloat(s)*(s.endsWith('M')?1e6:s.endsWith('K')?1e3:1);return Number.isInteger(n)&&n>=150&&n<=15000000?n:null;};
 const values=[...new Set(current.texts.map(parse).filter(n=>n!==null))];
 $('price').value=values.length===1?values[0]:'';$('pc').checked=false;
 $('card').textContent=current.name+' · ID '+current.id;
 $('status').textContent=values.length===1?'Znaleziono widoczną cenę w sekcji PC. Sprawdź i potwierdź.':'Nie znaleziono jednoznacznej sekcji PC. Wpisz cenę ręcznie tylko jeśli widzisz ją na stronie z wybranym PC.';
 $('confirm').hidden=false;
 }catch(e){$('status').textContent=e.message;}};
$('confirm').onsubmit=async e=>{e.preventDefault();if(!current)return;const p=Number($('price').value);if(!$('pc').checked||!Number.isInteger(p)||p<150||p>15000000)return;const list=await rows();list.push({game:'fc27',platform:'pc',card_id:current.id,name:current.name,version:'Card '+current.id,market_price:p,updated_at:new Date().toISOString(),source_url:current.url});await chrome.storage.local.set({observations:list});$('confirm').hidden=true;$('status').textContent='Zapisano potwierdzony odczyt.';await count();await sync();};
$('export').onclick=async()=>{const data=await rows();if(!data.length){$('status').textContent='Najpierw zapisz odczyt.';return;}const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='fcscanner-pc-observations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
count();

async function sync(){try{const saved=await chrome.storage.local.get(['collectorToken','observations']);if(!saved.collectorToken){$('status').textContent+=' Ustaw token, aby wysłać do chmury.';return;}const list=saved.observations||[];for(let i=0;i<list.length;i+=100){const r=await fetch('https://ztxbktelvqfisafywmvx.supabase.co/rest/v1/rpc/fcscanner_upload',{method:'POST',headers:{apikey:'sb_publishable_-r1TbaNpDb4tD-sdFwf4kg_btsGHHkX','Content-Type':'application/json'},body:JSON.stringify({collector_token:saved.collectorToken,observations:list.slice(i,i+100)}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);if(i+100<list.length)await new Promise(resolve=>setTimeout(resolve,5500));}$('status').textContent='Odczyty zapisane w Supabase. Lokalna kopia zachowana.';}catch(e){$('status').textContent='Wysyłanie nieudane: '+e.message+'. Odczyty pozostają lokalnie.';}}
$('saveToken').onclick=async()=>{const token=$('token').value.trim();if(!/^fc_[a-f0-9]{64}$/.test(token)){$('status').textContent='Wpisz dedykowany token fc_…';return;}await chrome.storage.local.set({collectorToken:token});$('token').value='';$('status').textContent='Token zapisany lokalnie.';};
$('sync').onclick=sync;

chrome.storage.local.get(['autoEnabled','autoStatus']).then(s=>{$('auto').checked=s.autoEnabled!==false;$('autoStatus').textContent=s.autoStatus||'Czekam na widoczną cenę PC.';});
$('auto').onchange=()=>chrome.storage.local.set({autoEnabled:$('auto').checked});
chrome.storage.onChanged.addListener((changes)=>{if(changes.autoStatus)$('autoStatus').textContent=changes.autoStatus.newValue;if(changes.observations)count();});

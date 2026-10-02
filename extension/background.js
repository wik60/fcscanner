let chain=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message.type!=='pc-observation')return;
 chain=chain.catch(()=>{}).then(async()=>{
 const r=message.row;const source=sender.url||'';
 if(!/^https:\/\/www\.futbin\.com\/27\/player\/\d+(?:\/|$)/.test(source)||r.source_url!==source||r.platform!=='pc'||r.game!=='fc27')return;
 const saved=await chrome.storage.local.get(['autoEnabled','observations','collectorToken']);
 if(saved.autoEnabled===false)return;
 const list=saved.observations||[];
 // Two tabs displaying the same price in a short interval must not create fake history.
 const previous=list.filter(x=>x.card_id===r.card_id).at(-1);
 if(previous&&previous.market_price===r.market_price&&Date.parse(r.updated_at)-Date.parse(previous.updated_at)<1800000)return;
 list.push(r);await chrome.storage.local.set({observations:list.slice(-10000),autoStatus:'Zapisano PC: '+r.name+' — '+r.market_price});
 if(!saved.collectorToken){await chrome.storage.local.set({autoStatus:'Odczyt zapisany lokalnie. Ustaw token do wysyłania.'});return;}
 await new Promise(resolve=>setTimeout(resolve,5500));
 try{const response=await fetch('https://ztxbktelvqfisafywmvx.supabase.co/rest/v1/rpc/fcscanner_upload',{method:'POST',headers:{apikey:'sb_publishable_-r1TbaNpDb4tD-sdFwf4kg_btsGHHkX','Content-Type':'application/json'},body:JSON.stringify({collector_token:saved.collectorToken,observations:[r]}),signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);await chrome.storage.local.set({autoStatus:'Wysłano PC: '+r.name+' — '+r.market_price});}catch(e){await chrome.storage.local.set({autoStatus:'Wysyłanie nieudane: '+e.message+'. Kopia lokalna zachowana; użyj Wyślij zapisane odczyty.'});}
 });
 chain.then(()=>reply({ok:true}),()=>reply({ok:false}));return true;
});

chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(m.type!=='pc-history')return;
 chain=chain.catch(()=>{}).then(async()=>{
 if(!/^https:\/\/www\.futbin\.com\/27\/player\/\d+(?:\/|$)/.test(sender.url||'')||m.card?.source_url!==sender.url)return;
 const saved=await chrome.storage.local.get(['autoEnabled','collectorToken','historyQueue']);
 if(saved.autoEnabled===false)return;
 const queue=saved.historyQueue||{};queue[m.card.card_id]={card:m.card,points:m.points};await chrome.storage.local.set({historyQueue:queue});
 const token=saved.collectorToken||globalThis.FC_COLLECTOR_TOKEN;if(!token){await chrome.storage.local.set({autoStatus:'Historia PC lokalnie. Ustaw token.'});return;}
 await new Promise(r=>setTimeout(r,5500));
 try{const response=await fetch('https://ztxbktelvqfisafywmvx.supabase.co/rest/v1/rpc/fcscanner_upload_history',{method:'POST',headers:{apikey:'sb_publishable_-r1TbaNpDb4tD-sdFwf4kg_btsGHHkX','Content-Type':'application/json'},body:JSON.stringify({collector_token:token,card:m.card,points:m.points}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('HTTP '+response.status);delete queue[m.card.card_id];await chrome.storage.local.set({historyQueue:queue,autoStatus:'Historia PC wysłana: '+m.points.length+' punktów — '+m.card.name});}
 catch(e){await chrome.storage.local.set({autoStatus:'Historia PC niewysłana: '+e.message+'. Odśwież stronę, aby ponowić.'});}
 });chain.then(()=>reply({ok:true}),()=>reply({ok:false}));return true;
});

import {loadMarket} from './cloud.mjs';
import {mergeHistory,analyze,validateBackup} from './market.mjs';
const $=id=>document.getElementById(id),fmt=n=>Math.round(n).toLocaleString('pl-PL'),key='fcscanner-market-v1';
let history={},events=[],selected=null,isDemo=false,realState=null;
function say(text){$('marketMessage').textContent=text;}
try{const stored=localStorage.getItem(key);if(stored){const v=validateBackup(JSON.parse(stored));history=v.history;events=v.events;}}catch(e){say('Nie udało się odczytać zapisanej historii. Możesz przywrócić kopię JSON.');}
function persist(){if(isDemo)return;try{localStorage.setItem(key,JSON.stringify({schema:1,history,events}));}catch(e){say('Historia jest w pamięci tej karty przeglądarki. Eksportuj kopię — zapis lokalny się nie udał.');}}
function draw(canvas,points){
 const rect=canvas.getBoundingClientRect(),scale=window.devicePixelRatio||1,w=Math.max(280,rect.width),h=220;
 canvas.width=w*scale;canvas.height=h*scale;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.clearRect(0,0,w,h);
 if(!points.length)return;
 const lo=Math.min(...points.map(p=>p.price)),hi=Math.max(...points.map(p=>p.price)),span=Math.max(hi-lo,lo*.01),t0=points[0].t,t1=points.at(-1).t;
 const x=p=>65+(p.t-t0)/Math.max(t1-t0,1)*(w-90),y=p=>170-(p.price-lo)/span*130;
 ctx.font='13px system-ui';ctx.fillStyle='#a8b9c7';ctx.fillText(fmt(hi),5,35);ctx.fillText(fmt(lo),5,170);
 ctx.strokeStyle='#2b3b49';ctx.beginPath();ctx.moveTo(65,175);ctx.lineTo(w-20,175);ctx.stroke();
 ctx.strokeStyle='#b4f578';ctx.lineWidth=2;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(x(p),y(p)):ctx.moveTo(x(p),y(p)));ctx.stroke();
 ctx.fillStyle='#b4f578';for(const p of points){ctx.beginPath();ctx.arc(x(p),y(p),3,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#a8b9c7';ctx.fillText(new Date(t0).toLocaleString('pl-PL'),65,205);ctx.textAlign='right';ctx.fillText(new Date(t1).toLocaleString('pl-PL'),w-20,205);
}
function detail(id){
 selected=id;const c=history[id];if(!c){$('analysisDetail').hidden=true;return;}
 const a=analyze(c,events);$('analysisDetail').hidden=false;$('selectedName').textContent=c.name+' · '+c.version;
 $('category').value=c.category;$('direction').textContent=a.direction;$('confidence').textContent=a.confidence;$('horizon').textContent=a.horizon??'—';$('decision').textContent=a.action??'Zbieraj obserwacje.';
 $('reasons').replaceChildren();$('risks').replaceChildren();for(const [target,values] of [['reasons',a.reasons],['risks',a.risks]])for(const text of values){const li=document.createElement('li');li.textContent=text;$(target).append(li);}
 $('chartCaption').textContent=a.points.length?`${a.points.length} ${isDemo?'punktów demonstracyjnych':'zapisanych odczytów'}. Linia łączy odczyty; nie jest prognozą. Oś X: czas lokalny, oś Y: coins.`:'Brak obserwacji.';
 draw($('priceChart'),a.points);
}
function render(){
 $('analysisMode').textContent=isDemo?'FIKCYJNY PRZYKŁAD — nie używaj do zakupów':'Analiza Twojej historii';
 $('historyCount').textContent=Object.keys(history).length;$('pointCount').textContent=Object.values(history).reduce((n,c)=>n+c.points.length,0);$('eventCount').textContent=events.filter(e=>e.start<=Date.now()&&e.end>Date.now()).length;
 $('analysisRows').replaceChildren();
 const cards=Object.values(history).sort((a,b)=>b.points.at(-1).t-a.points.at(-1).t);
 for(const c of cards){const a=analyze(c,events),tr=document.createElement('tr');const values=[c.name,c.version,fmt(a.last?.price??0),a.delta6===null?'—':a.delta6.toFixed(1)+'%',a.direction];
 for(const val of values){const td=document.createElement('td');td.textContent=val;tr.append(td);}const td=document.createElement('td'),button=document.createElement('button');button.className='secondary';button.textContent='Analizuj';button.onclick=()=>detail(c.id);td.append(button);tr.append(td);$('analysisRows').append(tr);}
 $('analysisEmpty').hidden=cards.length>0;$('analysisTable').hidden=!cards.length;
 $('eventsList').replaceChildren();for(const e of events.toSorted((a,b)=>b.start-a.start)){const li=document.createElement('li'),text=document.createElement('span');text.textContent=`${e.title} · ${new Date(e.start).toLocaleString('pl-PL')} · ${e.end>Date.now()?'aktywne/zaplanowane':'zakończone'} · ${e.scope==='ids'?'karty '+e.ids.join(', '):e.scope}`;li.append(text);if(e.url){const link=document.createElement('a');link.href=e.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Źródło';li.append(link);}const del=document.createElement('button');del.className='secondary';del.textContent=e.cloud?'W chmurze':'Usuń';del.disabled=!!e.cloud;del.onclick=()=>{events=events.filter(v=>v.id!==e.id);persist();render();};li.append(del);$('eventsList').append(li);}
 if(selected)detail(selected);
}
window.addEventListener('fc-prices',e=>{
 if(e.detail.demo)return;
 if(isDemo&&realState){history=realState.history;events=realState.events;isDemo=false;realState=null;$('analysisDemo').textContent='Zobacz fikcyjny przykład';}
 history=mergeHistory(history,e.detail.rows);persist();say('Zapisano obserwacje z oryginalnymi czasami. Powtórny import tego samego odczytu nie powiększa historii.');render();
});
$('category').addEventListener('change',()=>{if(selected){history[selected].category=$('category').value;persist();render();}});
$('eventForm').addEventListener('submit',e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const start=Date.parse(f.start),end=Date.parse(f.end),ids=f.ids.split(',').map(v=>v.trim()).filter(Boolean);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){say('Koniec wydarzenia musi być po początku.');return;}if(f.scope==='ids'&&!ids.length){say('Wpisz ID kart, których dotyczy wydarzenie.');return;}let url='';try{if(f.url){const parsed=new URL(f.url);if(parsed.protocol!=='https:')throw Error();url=parsed.href;}}catch{say('Źródło musi być adresem HTTPS.');return;}
 events.push({id:crypto.randomUUID(),title:f.title,type:f.type,scope:f.scope,ids,start,end,created:Date.now(),url});persist();render();e.target.reset();say('Dodano wydarzenie. Wpływ jest regułą do sprawdzenia, nie potwierdzoną zmianą ceny.');});
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('backup').onclick=()=>download({schema:1,history,events,demo:isDemo},isDemo?'fictional-market-demo.json':'fcscanner-history.json');
$('restore').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error('Kopia jest zbyt duża.');const value=validateBackup(JSON.parse(await file.text()));if(value.demo)throw Error('Fikcyjnej kopii nie można przywrócić jako prawdziwych danych.');if(isDemo&&realState){history=realState.history;events=realState.events;isDemo=false;realState=null;$('analysisDemo').textContent='Zobacz fikcyjny przykład';}for(const [id,c] of Object.entries(value.history)){if(!history[id])history[id]=c;else{const unique=new Map([...history[id].points,...c.points].map(p=>[p.t,p]));history[id].points=[...unique.values()].sort((a,b)=>a.t-b.t).slice(-500);}}events=[...new Map([...events,...value.events].map(v=>[v.id,v])).values()];persist();render();say('Połączono kopię z historią w tej przeglądarce.');}catch(e){say(e.message);}finally{e.target.value='';}});
$('analysisDemo').onclick=()=>{if(isDemo){history=realState.history;events=realState.events;isDemo=false;realState=null;selected=null;$('analysisDemo').textContent='Zobacz fikcyjny przykład';render();return;}realState={history:structuredClone(history),events:structuredClone(events)};isDemo=true;const now=Date.now();history=mergeHistory({},Array.from({length:9},(_,i)=>({game:'fc27',platform:'pc',card_id:'DEMO',name:'Przykładowa karta SBC',version:'Fikcyjna karta',market_price:4000+i*100,updated_at:new Date(now-(8-i)*3600000).toISOString()})));history.DEMO.category='fodder';events=[{id:'demo-event',type:'sbc',title:'Fikcyjny SBC',scope:'fodder',ids:[],start:now-3600000,end:now+86400000,created:now-3600000}];selected='DEMO';$('analysisDemo').textContent='Wróć do moich danych';render();};
window.addEventListener('resize',()=>{if(selected)detail(selected);});setInterval(render,60000);render();
// First-party file contains only user-supplied price observations; no credentials.
(async()=>{try{const response=await fetch('./initial-observations.json');if(!response.ok)return;const seed=await response.json();if(isDemo&&realState)realState.history=mergeHistory(realState.history,seed);else{history=mergeHistory(history,seed);persist();render();}}catch{}})();

async function refreshCloud(){try{const data=await loadMarket();const target=isDemo&&realState?realState:null;if(target){target.history=mergeHistory(target.history,data.rows);target.events=[...target.events.filter(e=>!e.cloud),...data.events];}else{history=mergeHistory(history,data.rows);events=[...events.filter(e=>!e.cloud),...data.events];persist();render();}say('Supabase: '+data.rows.length+' odczytów. Odczyt z chmury; nowe importy i wydarzenia formularza zapisują się lokalnie.');}catch(e){say('Nie udało się pobrać Supabase. Dostępna historia lokalna. '+e.message);}}
refreshCloud();setInterval(refreshCloud,300000);

import {positionValue} from './features.mjs';
import {loadMarket} from './cloud.mjs';
import {mergeHistory,mergeAverageHistory,averageContext,analyze,validateBackup} from './market.mjs';
const $=id=>document.getElementById(id),fmt=n=>Math.round(n).toLocaleString('pl-PL'),key='fcscanner-market-v1';
let history={},events=[],selected=null,isDemo=false,realState=null;
let chartKind='daily';
let portfolio=[];try{const saved=JSON.parse(localStorage.getItem('fcscanner-portfolio-v1')||'[]');if(validPortfolio(saved))portfolio=saved;}catch{}
function validPortfolio(p){return Array.isArray(p)&&p.length<=1000&&p.every(x=>typeof x.id==='string'&&typeof x.key==='string'&&Number.isInteger(x.buy)&&x.buy>=150&&Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=100&&(x.sell==null||(Number.isInteger(x.sell)&&x.sell>=150)));}
function savePortfolio(){try{localStorage.setItem('fcscanner-portfolio-v1',JSON.stringify(portfolio));}catch{$('portfolioMessage').textContent='Zapis nie powiódł się. Eksportuj kopię.';}renderPortfolio();}
function renderPortfolio(){ $('portfolioRows').replaceChildren();for(const p of portfolio){const c=history[p.id],last=c?.points.at(-1),fresh=last&&Date.now()-last.t<=1800000,price=p.sell??(fresh?last.price:null),v=positionValue(p,price),tr=document.createElement('tr');for(const value of [(c?.name??p.id)+' × '+p.quantity,fmt(v.cost),v.net===null?'Brak aktualnej ceny':fmt(v.net),v.profit===null?'—':fmt(v.profit),fmt(v.breakEven)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}const td=document.createElement('td');if(p.sell){td.textContent='Sprzedano po '+fmt(p.sell);}else{const sell=document.createElement('button');sell.textContent='Zapisz sprzedaż';sell.onclick=()=>{const raw=prompt('Rzeczywista cena sprzedaży jednej sztuki (cała pozycja):');if(raw===null)return;const n=Number(raw);if(!Number.isInteger(n)||n<150){$('portfolioMessage').textContent='Podaj cenę całkowitą co najmniej 150.';return;}p.sell=n;savePortfolio();};td.append(sell);}const del=document.createElement('button');del.className='secondary';del.textContent='Usuń wpis';del.onclick=()=>{if(confirm('Usunąć wpis z dziennika?')){portfolio=portfolio.filter(x=>x.key!==p.key);savePortfolio();}};td.append(del);tr.append(td);$('portfolioRows').append(tr);}}
$('portfolioForm').onsubmit=e=>{e.preventDefault();if(isDemo){$('portfolioMessage').textContent='Wróć do prawdziwych danych przed zapisaniem zakupu.';return;}const f=Object.fromEntries(new FormData(e.target)),entry={key:crypto.randomUUID(),id:f.id.trim(),buy:Number(f.buy),quantity:Number(f.quantity)};if(!history[entry.id]||!validPortfolio([entry])){$('portfolioMessage').textContent='Podaj ID śledzonej karty i prawidłowy zakup.';return;}portfolio.push(entry);savePortfolio();e.target.reset();};
$('portfolioExport').onclick=()=>download({schema:1,positions:portfolio},'fcscanner-portfolio.json');
$('portfolioImport').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>1000000)throw Error('Plik za duży.');const v=JSON.parse(await f.text());if(v.schema!==1||!validPortfolio(v.positions))throw Error('Nieprawidłowe portfolio.');portfolio=[...new Map([...portfolio,...v.positions].map(p=>[p.key,p])).values()];savePortfolio();}catch(err){$('portfolioMessage').textContent=err.message;}finally{e.target.value='';}};

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
 $('category').value=c.category;$('cardRating').value=c.rating??'';$('direction').textContent=a.direction==='Za mało danych'?'Za mało bieżących odczytów':a.direction;$('confidence').textContent=a.confidence;$('horizon').textContent=a.horizon??'—';$('decision').textContent=a.action??'Zbieraj obserwacje.';
 $('reasons').replaceChildren();$('risks').replaceChildren();for(const [target,values] of [['reasons',a.reasons],['risks',a.risks]])for(const text of values){const li=document.createElement('li');li.textContent=text;$(target).append(li);}
 $('chartCaption').textContent=a.points.length?`${a.points.length} ${isDemo?'punktów demonstracyjnych':'zapisanych odczytów'}. Linia łączy odczyty; nie jest prognozą. Oś X: czas lokalny, oś Y: coins.`:'Brak obserwacji.';
 const contexts=averageContext(c);
 for(const ctx of contexts){if(ctx.count){const li=document.createElement('li');li.textContent=(ctx.kind==='daily'?'Średnie dzienne':'Średnie godzinowe')+' FUTBIN: '+ctx.count+' punktów przez '+ctx.span.toFixed(1)+' h; zmiana pierwszej do ostatniej średniej: '+(ctx.change===null?'—':ctx.change.toFixed(1)+'%')+'.';$('reasons').append(li);}}
 let controls=$('historySeries');if(!controls){controls=document.createElement('div');controls.id='historySeries';$('priceChart').before(controls);}controls.replaceChildren();
 const series={live:a.points,daily:c.averages?.daily||[],hourly:c.averages?.hourly||[]};
 if(!series[chartKind].length)chartKind=series.hourly.length?'hourly':series.live.length?'live':'daily';
 for(const [kind,label] of [['live','Bieżące odczyty'],['hourly','Średnie godzinowe'],['daily','Średnie dzienne']]){const button=document.createElement('button');button.textContent=label+' ('+series[kind].length+')';button.disabled=!series[kind].length||chartKind===kind;button.onclick=()=>{chartKind=kind;detail(id);};controls.append(button);}
 const shown=series[chartKind];
 if(chartKind!=='live')$('chartCaption').textContent=shown.length+' średnich '+(chartKind==='daily'?'dziennych':'godzinowych')+' PC z FUTBIN. To średnie historyczne; nie bieżąca oferta ani prognoza. Oś X: czas lokalny, oś Y: coins.';
 draw($('priceChart'),shown);
}
function render(){
 $('analysisMode').textContent=isDemo?'FIKCYJNY PRZYKŁAD — nie używaj do zakupów':'Analiza Twojej historii';
 $('historyCount').textContent=Object.keys(history).length;$('pointCount').textContent=Object.values(history).reduce((n,c)=>n+c.points.length+(c.averages?.daily.length||0)+(c.averages?.hourly.length||0),0);$('eventCount').textContent=events.filter(e=>e.start<=Date.now()&&e.end>Date.now()).length;
 $('analysisRows').replaceChildren();
 const cards=Object.values(history).sort((a,b)=>(b.points.at(-1)?.t??0)-(a.points.at(-1)?.t??0));
 for(const c of cards){const a=analyze(c,events),tr=document.createElement('tr');const values=[c.name,c.version,a.last?fmt(a.last.price):'Brak bieżącej ceny',a.delta6==null?'—':a.delta6.toFixed(1)+'%',a.direction==='Za mało danych'?'Za mało bieżących odczytów':a.direction];
 for(const val of values){const td=document.createElement('td');td.textContent=val;tr.append(td);}const td=document.createElement('td'),button=document.createElement('button');button.className='secondary';button.textContent='Analizuj';button.onclick=()=>detail(c.id);td.append(button);tr.append(td);$('analysisRows').append(tr);}
 $('analysisEmpty').hidden=cards.length>0;$('analysisTable').hidden=!cards.length;
 $('eventsList').replaceChildren();for(const e of events.toSorted((a,b)=>b.start-a.start)){const li=document.createElement('li'),text=document.createElement('span');text.textContent=`${e.title} · ${new Date(e.start).toLocaleString('pl-PL')} · ${e.end>Date.now()?'aktywne/zaplanowane':'zakończone'} · ${e.scope==='ids'?'karty '+e.ids.join(', '):e.scope}`;li.append(text);if(e.url){const link=document.createElement('a');link.href=e.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Źródło';li.append(link);}const del=document.createElement('button');del.className='secondary';del.textContent=e.cloud?'W chmurze':'Usuń';del.disabled=!!e.cloud;del.onclick=()=>{events=events.filter(v=>v.id!==e.id);persist();render();};li.append(del);$('eventsList').append(li);}
 if(selected)detail(selected);renderPortfolio();
}
window.addEventListener('fc-prices',e=>{
 if(e.detail.demo)return;
 if(isDemo&&realState){history=realState.history;events=realState.events;isDemo=false;realState=null;$('analysisDemo').textContent='Zobacz fikcyjny przykład';}
 history=mergeHistory(history,e.detail.rows);persist();say('Zapisano obserwacje z oryginalnymi czasami. Powtórny import tego samego odczytu nie powiększa historii.');render();
});
$('category').addEventListener('change',()=>{if(selected){history[selected].category=$('category').value;persist();render();}});
$('eventForm').addEventListener('submit',e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const start=Date.parse(f.start),end=Date.parse(f.end),ids=f.ids.split(',').map(v=>v.trim()).filter(Boolean);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){say('Koniec wydarzenia musi być po początku.');return;}if(f.scope==='ids'&&!ids.length){say('Wpisz ID kart, których dotyczy wydarzenie.');return;}let url='';try{if(f.url){const parsed=new URL(f.url);if(parsed.protocol!=='https:')throw Error();url=parsed.href;}}catch{say('Źródło musi być adresem HTTPS.');return;}
 const requirements={minRating:f.minRating?Number(f.minRating):null,maxRating:f.maxRating?Number(f.maxRating):null};if(requirements.minRating&&requirements.maxRating&&requirements.minRating>requirements.maxRating){say('Nieprawidłowy zakres ratingów.');return;}
 events.push({requirements,id:crypto.randomUUID(),title:f.title,type:f.type,scope:f.scope,ids,start,end,created:Date.now(),url});persist();render();e.target.reset();say('Dodano wydarzenie. Wpływ jest regułą do sprawdzenia, nie potwierdzoną zmianą ceny.');});
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('backup').onclick=()=>download({schema:1,history,events,demo:isDemo},isDemo?'fictional-market-demo.json':'fcscanner-history.json');
$('restore').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error('Kopia jest zbyt duża.');const value=validateBackup(JSON.parse(await file.text()));if(value.demo)throw Error('Fikcyjnej kopii nie można przywrócić jako prawdziwych danych.');if(isDemo&&realState){history=realState.history;events=realState.events;isDemo=false;realState=null;$('analysisDemo').textContent='Zobacz fikcyjny przykład';}for(const [id,c] of Object.entries(value.history)){if(!history[id])history[id]=c;else{const unique=new Map([...history[id].points,...c.points].map(p=>[p.t,p]));history[id].points=[...unique.values()].sort((a,b)=>a.t-b.t).slice(-500); }if(c.averages){const averageRows=['daily','hourly'].flatMap(kind=>(c.averages[kind]||[]).map(p=>({game:'fc27',platform:'pc',card_id:id,interval_kind:kind,observed_at:new Date(p.t).toISOString(),price:p.price,source_url:c.source_url})));history=mergeAverageHistory(history,averageRows);}}events=[...new Map([...events,...value.events].map(v=>[v.id,v])).values()];persist();render();say('Połączono kopię z historią w tej przeglądarce.');}catch(e){say(e.message);}finally{e.target.value='';}});
$('analysisDemo').onclick=()=>{if(isDemo){history=realState.history;events=realState.events;isDemo=false;realState=null;selected=null;$('analysisDemo').textContent='Zobacz fikcyjny przykład';render();return;}realState={history:structuredClone(history),events:structuredClone(events)};isDemo=true;const now=Date.now();history=mergeHistory({},Array.from({length:9},(_,i)=>({game:'fc27',platform:'pc',card_id:'DEMO',name:'Przykładowa karta SBC',version:'Fikcyjna karta',market_price:4000+i*100,updated_at:new Date(now-(8-i)*3600000).toISOString()})));history.DEMO.category='fodder';events=[{id:'demo-event',type:'sbc',title:'Fikcyjny SBC',scope:'fodder',ids:[],start:now-3600000,end:now+86400000,created:now-3600000}];selected='DEMO';$('analysisDemo').textContent='Wróć do moich danych';render();};
$('cardRating').onchange=()=>{if(selected){const n=Number($('cardRating').value);history[selected].manualRating=true;history[selected].rating=Number.isInteger(n)&&n>=1&&n<=99?n:null;persist();render();}};
 window.addEventListener('resize',()=>{if(selected)detail(selected);});setInterval(render,60000);render();
// First-party file contains only user-supplied price observations; no credentials.
(async()=>{try{const response=await fetch('./initial-observations.json');if(!response.ok)return;const seed=await response.json();if(isDemo&&realState)realState.history=mergeHistory(realState.history,seed);else{history=mergeHistory(history,seed);persist();render();}}catch{}})();

async function refreshCloud(){try{const data=await loadMarket();window.fcscannerCloud=data;window.dispatchEvent(new CustomEvent('fc-cloud',{detail:data}));const target=isDemo&&realState?realState:null;if(target){target.history=mergeAverageHistory(mergeHistory(target.history,data.rows),data.averages);target.events=[...target.events.filter(e=>!e.cloud),...data.events];}else{history=mergeAverageHistory(mergeHistory(history,data.rows),data.averages);events=[...events.filter(e=>!e.cloud),...data.events];persist();render();}say('Supabase: '+data.rows.length+' bieżących odczytów i '+data.averages.length+' historycznych średnich PC. Odczyt z chmury; nowe importy i wydarzenia formularza zapisują się lokalnie.');}catch(e){say('Nie udało się pobrać Supabase. Dostępna historia lokalna. '+e.message);}}
refreshCloud();setInterval(refreshCloud,300000);

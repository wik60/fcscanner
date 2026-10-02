import {trend,matchesEvent} from './features.mjs';
// Transparent heuristic signals, not a trained model or calibrated probabilities.
const HOUR=3600000;
export function mergeHistory(history,rows){
 const next=structuredClone(history||{});
 for(const r of rows){
  const t=Date.parse(r.updated_at),price=Number(r.market_price),id=String(r.card_id??'');
  if(r.game!=='fc27'||r.platform!=='pc'||!id||!Number.isFinite(t)||!Number.isFinite(price)||price<150)continue;
  const card=next[id]||{id,name:String(r.name??id).replace(/ EA FC 27 Prices and Rating$/i,''),version:String(r.version??''),category:'unknown',points:[]};
  if(card.name==='Karta '+id){card.name=String(r.name??card.name);card.version=String(r.version??card.version);}
  const old=card.points.find(p=>p.t===t);if(!old)card.points.push({t,price});
  card.points.sort((a,b)=>a.t-b.t);card.points=card.points.slice(-500);
  card.rating=card.manualRating?card.rating:(r.rating??card.rating??null);card.source_url=r.source_url??card.source_url;
  next[id]=card;
 }
 return next;
}
export function mergeAverageHistory(history,rows){
 const next=structuredClone(history||{});
 for(const r of rows){
 const id=String(r.card_id??''),kind=r.interval_kind,t=Date.parse(r.observed_at),price=Number(r.price);
 if(r.game!=='fc27'||r.platform!=='pc'||!id||!['daily','hourly'].includes(kind)||!Number.isFinite(t)||!Number.isFinite(price)||price<150)continue;
 const c=next[id]||{id,name:'Karta '+id,version:'',category:'unknown',points:[]};
 c.averages??={daily:[],hourly:[]};
 const series=c.averages[kind]||[];
 const map=new Map(series.map(p=>[p.t,p]));map.set(t,{t,price});
 c.averages[kind]=[...map.values()].sort((a,b)=>a.t-b.t).slice(-500);
 c.source_url??=r.source_url;next[id]=c;
 }
 return next;
}
export function averageContext(card){
 const series=card.averages||{};
 return ['hourly','daily'].map(kind=>{
 const p=series[kind]||[],last=p.at(-1),first=p[0];
 return {kind,points:p,count:p.length,span:first&&last?(last.t-first.t)/HOUR:0,change:p.length>1?(last.price/first.price-1)*100:null};
 });
}
export function changeAt(points,hours){
 if(!points.length)return null;
 const last=points.at(-1),target=last.t-hours*HOUR;
 const before=points.filter(p=>p.t<=target).at(-1);
 if(!before||target-before.t>Math.max(HOUR,hours*.3*HOUR))return null;
 return (last.price/before.price-1)*100;
}
function analyzeLive(card,events,now=Date.now()){
 const points=(card.points||[]).filter(p=>p.t<=now+60000).sort((a,b)=>a.t-b.t),last=points.at(-1);
 const reasons=[],risks=['Heurystyka nie była sprawdzona na historycznych transakcjach.','Brak danych o wolumenie i szybkości sprzedaży.'];
 if(!last)return {direction:'Brak danych',confidence:'Brak',score:0,reasons:['Brak prawidłowych obserwacji cen.'],risks,points:[]};
 const span=(last.t-points[0].t)/HOUR,age=(now-last.t)/60000;
 const adequate=points.length>=4&&span>=6;
 let technical=0,eventScore=0;
 const delta6=changeAt(points,6),delta24=changeAt(points,24);
 if(adequate&&delta6!==null){technical=delta6>=2?1:delta6<=-2?-1:0;reasons.push(`Zmiana w około 6 h: ${delta6.toFixed(1)}%.`);}
 else reasons.push(`Historia: ${points.length} obserwacji przez ${span.toFixed(1)} h; minimum to 4 obserwacje i 6 h.`);
 const active=events.filter(e=>e.start<=now&&e.end>now&&e.created<=now&&matchesEvent(card,e));
 for(const e of active){
  const sign={packs:-1,rewards:-1,sbc:1,evo:1,promo:-1}[e.type];if(sign===undefined)continue;
  eventScore+=sign;
  const detail={packs:'Możliwa dodatkowa podaż z paczek.',rewards:'Możliwa dodatkowa podaż z nagród.',sbc:'Wskazany SBC może zwiększyć popyt.',evo:'Wskazana ewolucja może zwiększyć popyt.',promo:'Wskazana promocja może zwiększyć podaż lub dać alternatywne karty.'}[e.type];
  reasons.push(`${e.title}: ${detail}`);
  if(e.scope==='all')risks.push('Wydarzenie przypisane do całej listy; wpływ na tę wersję karty nie został potwierdzony.');
 }
 const conflict=active.some(e=>['sbc','evo'].includes(e.type))&&active.some(e=>['packs','rewards','promo'].includes(e.type));
 if(conflict)risks.push('Jednocześnie występują sygnały zwiększonego popytu i podaży.');
 if(!active.length)reasons.push('Brak przypisanych aktywnych wydarzeń.');
 const averages=trend(points,now);
 if(averages.ma6!==null&&averages.ma24!==null)reasons.push('Średnia odczytów 6 h: '+Math.round(averages.ma6)+'; 24 h: '+Math.round(averages.ma24)+'.');
 if(averages.deviation!==null)reasons.push('Cena względem średniej 24 h: '+averages.deviation.toFixed(1)+'%.');
 const score=technical+Math.max(-2,Math.min(2,eventScore));
 let direction=!adequate?'Za mało danych':Math.abs(score)<1?'Brak wyraźnego kierunku':score>0?'Sygnał wzrostowy':'Sygnał spadkowy';
 if(age>30){direction='Nieaktualne ceny';risks.unshift(`Ostatni odczyt ma ${Math.round(age)} min. Odśwież ceny przed decyzją.`);}
 const confidence=age>30||!adequate?'Niewystarczające dane':'Niska — model regułowy';
 return {direction,confidence,score,reasons,risks,points,last,age,delta6,delta24,active:active.length,horizon:'6–24 h',action:direction==='Sygnał wzrostowy'?'Obserwuj; sprawdź reakcję rynku i limit zakupu.':direction==='Sygnał spadkowy'?'Wstrzymaj nowy zakup; sprawdź, czy spadek trwa.':'Obserwuj i zbieraj kolejne odczyty.'};
}
export function analyze(card,events,now=Date.now()){
 const live=analyzeLive(card,events,now);
 if(live.points.length>=4&&live.points.at(-1).t-live.points[0].t>=6*HOUR&&live.age<=30)return {...live,basis:'live'};
 // Use completed chart buckets only. Keep averages separate from current offers.
 const hourly=(card.averages?.hourly||[]).filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.price)&&p.price>=150&&p.t+HOUR<=now).sort((a,b)=>a.t-b.t);
 const daily=(card.averages?.daily||[]).filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.price)&&p.price>=150&&p.t+24*HOUR<=now).sort((a,b)=>a.t-b.t);
 const eligible=(p,minSpan)=>p.length>=4&&p.at(-1).t-p[0].t>=minSpan*HOUR;
 const recentHourly=eligible(hourly,3)&&now-hourly.at(-1).t<=6*HOUR;
 const kind=recentHourly?'hourly':eligible(daily,72)?'daily':eligible(hourly,3)?'hourly':null;
 if(!kind)return live;
 const series=(kind==='hourly'?hourly:daily).slice(kind==='hourly'?-7:-8),last=series.at(-1);
 const windowHours=kind==='hourly'?6:168;
 const baseline=series.filter(p=>p.t<=last.t-windowHours*HOUR).at(-1)||series[0];
 const span=(last.t-baseline.t)/HOUR,delta=(last.price/baseline.price-1)*100;
 const technical=delta>=2?1:delta<=-2?-1:0;
 const active=events.filter(e=>e.start<=now&&e.end>now&&e.created<=now&&matchesEvent(card,e));
 const eventScore=active.reduce((n,e)=>n+({packs:-1,rewards:-1,sbc:1,evo:1,promo:-1}[e.type]||0),0);
 const score=technical+Math.max(-2,Math.min(2,eventScore));
 const stale=now-last.t>(kind==='hourly'?6:72)*HOUR;
 const label=kind==='hourly'?'średnie godzinowe':'średnie dzienne';
 const trendLabel=technical>0?'Trend wzrostowy':technical<0?'Trend spadkowy':'Trend boczny';
 const direction=(stale?'Historyczny trend':trendLabel)+' ('+label+')';
 const reasons=[`Podstawa analizy: ${series.length} zakończonych średnich PC z FUTBIN; zmiana przez ${span.toFixed(1)} h: ${delta.toFixed(1)}%.`,
 `Ostatnia średnia: ${Math.round(last.price)} coins, ${new Date(last.t).toLocaleString('pl-PL')}.`];
 if(live.last)reasons.push(`Bieżący odczyt ${Math.round(live.last.price)} coins jest przechowywany osobno od średnich.`);
 else reasons.push('Brak bieżącej oferty. Ocena opisuje historię średnich.');
 if(active.length)reasons.push('Wydarzenia: '+active.map(e=>e.title).join(', ')+'. Osobny wynik wpływu: '+eventScore+'.');
 else reasons.push('Brak przypisanych aktywnych wydarzeń.');
 const risks=[...live.risks.filter(r=>!r.startsWith('Ostatni odczyt ma')),'Średnie FUTBIN nie potwierdzają dostępnej ceny zakupu ani przyszłego kierunku.'];
 if(!live.last||live.age>30)risks.unshift('Bieżąca cena wymaga odświeżenia przed wyznaczeniem ceny zakupu.');
 if(stale)risks.unshift('Historia średnich jest nieaktualna; trend opisuje zapisany okres.');
 return {...live,direction,confidence:stale?'Niska — historia nieaktualna':'Niska — trend średnich FUTBIN',score,technical,eventScore,reasons,risks,basis:kind,analysisPoints:series,analysisChange:delta,analysisSpan:span,delta6:kind==='hourly'?changeAt(series,6):null,delta24:changeAt(series,24),active:active.length,horizon:span.toFixed(0)+' h historii '+(kind==='hourly'?'godzinowej':'dziennej'),action:'Trend historyczny: '+(technical>0?'wzrost':technical<0?'spadek':'stabilizacja')+'. Sprawdź aktualną cenę i reakcję na wydarzenia przed zakupem.'};
}
export function validateBackup(value){
 if(!value||value.schema!==1||!value.history||typeof value.history!=='object'||Array.isArray(value.history)||!Array.isArray(value.events))throw new Error('Nieprawidłowa kopia historii.');
 const categories=['unknown','fodder','playable'];
 for(const [id,c] of Object.entries(value.history)){
  if(c.id!==id||typeof c.name!=='string'||!categories.includes(c.category)||!Array.isArray(c.points)||c.points.length>500||c.points.some(p=>!Number.isFinite(p.t)||!Number.isFinite(p.price)||p.price<150))throw new Error('Nieprawidłowe dane karty w kopii.');
 }
 for(const c of Object.values(value.history)){if(c.averages)for(const kind of ['daily','hourly']){const p=c.averages[kind];if(!Array.isArray(p)||p.length>500||p.some(v=>!Number.isFinite(v.t)||!Number.isFinite(v.price)||v.price<150))throw Error('Nieprawidłowa historia średnich.');}}
 if(value.events.some(e=>e.requirements&&([e.requirements.minRating,e.requirements.maxRating].some(n=>n!=null&&(!Number.isInteger(n)||n<1||n>99))||(e.requirements.minRating!=null&&e.requirements.maxRating!=null&&e.requirements.minRating>e.requirements.maxRating))))throw new Error('Nieprawidłowe filtry ratingu.');
 if(value.events.some(e=>!['packs','rewards','sbc','evo','promo'].includes(e.type)||typeof e.title!=='string'||!Array.isArray(e.ids)||!['all','fodder','playable','ids'].includes(e.scope)||![e.start,e.end,e.created].every(Number.isFinite)||e.end<=e.start))throw new Error('Nieprawidłowe wydarzenie w kopii.');
 return value;
}

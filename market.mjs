import {trend,matchesEvent} from './features.mjs';
// Transparent heuristic signals, not a trained model or calibrated probabilities.
const HOUR=3600000;
export function mergeHistory(history,rows){
 const next=structuredClone(history||{});
 for(const r of rows){
  const t=Date.parse(r.updated_at),price=Number(r.market_price),id=String(r.card_id??'');
  if(r.game!=='fc27'||r.platform!=='pc'||!id||!Number.isFinite(t)||!Number.isFinite(price)||price<150)continue;
  const card=next[id]||{id,name:String(r.name??id).replace(/ EA FC 27 Prices and Rating$/i,''),version:String(r.version??''),category:'unknown',points:[]};
  const old=card.points.find(p=>p.t===t);if(!old)card.points.push({t,price});
  card.points.sort((a,b)=>a.t-b.t);card.points=card.points.slice(-500);
  card.rating=card.manualRating?card.rating:(r.rating??card.rating??null);card.source_url=r.source_url??card.source_url;
  next[id]=card;
 }
 return next;
}
export function changeAt(points,hours){
 if(!points.length)return null;
 const last=points.at(-1),target=last.t-hours*HOUR;
 const before=points.filter(p=>p.t<=target).at(-1);
 if(!before||target-before.t>Math.max(HOUR,hours*.3*HOUR))return null;
 return (last.price/before.price-1)*100;
}
export function analyze(card,events,now=Date.now()){
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
export function validateBackup(value){
 if(!value||value.schema!==1||!value.history||typeof value.history!=='object'||Array.isArray(value.history)||!Array.isArray(value.events))throw new Error('Nieprawidłowa kopia historii.');
 const categories=['unknown','fodder','playable'];
 for(const [id,c] of Object.entries(value.history)){
  if(c.id!==id||typeof c.name!=='string'||!categories.includes(c.category)||!Array.isArray(c.points)||c.points.length>500||c.points.some(p=>!Number.isFinite(p.t)||!Number.isFinite(p.price)||p.price<150))throw new Error('Nieprawidłowe dane karty w kopii.');
 }
 if(value.events.some(e=>e.requirements&&([e.requirements.minRating,e.requirements.maxRating].some(n=>n!=null&&(!Number.isInteger(n)||n<1||n>99))||(e.requirements.minRating!=null&&e.requirements.maxRating!=null&&e.requirements.minRating>e.requirements.maxRating))))throw new Error('Nieprawidłowe filtry ratingu.');
 if(value.events.some(e=>!['packs','rewards','sbc','evo','promo'].includes(e.type)||typeof e.title!=='string'||!Array.isArray(e.ids)||!['all','fodder','playable','ids'].includes(e.scope)||![e.start,e.end,e.created].every(Number.isFinite)||e.end<=e.start))throw new Error('Nieprawidłowe wydarzenie w kopii.');
 return value;
}

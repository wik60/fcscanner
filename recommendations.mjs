import {floorPrice} from './engine.mjs';
import {mergeHistory,mergeAverageHistory,analyze} from './market.mjs';
export function recommend(data,{budget=200000,reserve=100000,minProfit=500,minRoi=.08,now=Date.now()}={}){
 if(![budget,reserve,minProfit,minRoi,now].every(Number.isFinite)||budget<0||reserve<0||reserve>budget||minProfit<0||minRoi<0)throw Error('Sprawdź budżet i progi zysku.');
 const history=mergeAverageHistory(mergeHistory({},data.rows||[]),data.averages||[]);
 const picks=[],rejected=[],position=Math.min(budget*.1,budget-reserve),events=data.events||[];
 for(const c of Object.values(history)){
 const reject=reason=>rejected.push({id:c.id,name:c.name,reason});
 const a=analyze(c,events,now),current=c.points.at(-1),age=current?(now-current.t)/60000:Infinity;
 if(!current||age>30||age< -1){reject('Odśwież cenę PC — brak odczytu z ostatnich 30 minut.');continue;}
 if(current.price>position*1.25){reject('Cena przekracza limit 10% budżetu na kartę.');continue;}
 if(!a.basis||a.confidence.includes('nieaktualna')){reject('Za mało aktualnej historii do wyznaczenia celu sprzedaży.');continue;}
 let series=a.basis==='live'?a.points.filter(p=>p.t>=now-24*3600000):a.analysisPoints;
 if(series.length<4){reject('Potrzebne co najmniej 4 punkty historii.');continue;}
 const delta=a.analysisChange??a.delta6??0;
 if(delta<=-5||/spadkowy/.test(a.direction)){reject('Trend spadkowy — wstrzymaj zakup.');continue;}
 const prices=series.map(p=>p.price).sort((a,b)=>a-b),mid=Math.floor(prices.length/2);
 const median=prices.length%2?prices[mid]:(prices[mid-1]+prices[mid])/2;
 const sell=floorPrice(Math.min(median,current.price*1.20)*.97),net=Math.floor(sell*.95);
 const maxBuy=floorPrice(Math.min(net-minProfit,net/(1+minRoi),position));
 if(maxBuy<150||maxBuy<current.price*.8){reject('Wymagany rabat jest zbyt duży lub brak opłacalnego limitu.');continue;}
 const actionable=current.price<=maxBuy,entry=actionable?current.price:maxBuy,profit=net-entry;
 if(profit<minProfit||profit/entry<minRoi){reject('Marża po podatku jest poniżej Twoich progów.');continue;}
 picks.push({id:c.id,name:c.name,version:c.version,buy:current.price,maxBuy,sell,profit,roi:profit/entry,entry,age,actionable,reference:true,copies:0,source_url:c.source_url,confidence:'Niska',reason:'Mediana historii '+Math.round(median)+'; bufor sprzedaży 3%; '+a.direction+'.',basis:a.basis,score:profit/entry});
 }
 picks.sort((a,b)=>Number(b.actionable)-Number(a.actionable)||b.score-a.score);
 let remaining=budget-reserve;
 for(const p of picks){p.copies=Math.min(3,Math.floor(position/p.entry),Math.floor(remaining/p.entry));remaining-=p.copies*p.entry;}
 return {picks:picks.filter(p=>p.copies>0),rejected,remaining};
}

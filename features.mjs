export function trend(points,now=Date.now()){
 const p=points.filter(p=>p.t<=now).sort((a,b)=>a.t-b.t);const last=p.at(-1);
 const mean=h=>{if(!last||!p.some(x=>x.t<=last.t-h*3600000))return null;const v=p.filter(x=>x.t>=last.t-h*3600000);return v.length>=3?v.reduce((s,x)=>s+x.price,0)/v.length:null;};
 const ma6=mean(6),ma24=mean(24);
 return {ma6,ma24,deviation:ma24&&last?(last.price/ma24-1)*100:null};
}
export function positionValue(position,price){
 const cost=position.buy*position.quantity;
 const net=price==null?null:Math.floor(price*.95)*position.quantity;
 return {cost,net,profit:net===null?null:net-cost,breakEven:Math.ceil(position.buy/.95)};
}
export function matchesEvent(card,event){
 const scope=event.ids?.includes(card.id)||event.scope==='all'||event.scope===card.category;
 if(!scope)return false;
 const r=event.requirements;
 if(!r)return true;
 if(r.minRating!=null||r.maxRating!=null){if(!Number.isInteger(card.rating))return false;if(r.minRating!=null&&card.rating<r.minRating)return false;if(r.maxRating!=null&&card.rating>r.maxRating)return false;}
 return true;
}

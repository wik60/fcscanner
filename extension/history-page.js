// Runs in page world; only exports explicitly PC-labelled timestamped chart data.
let fingerprint='';
setInterval(()=>{
 const id=location.pathname.match(/^\/27\/player\/(\d+)(?:\/|$)/)?.[1];if(!id)return;
 const points=[];
 for(const chart of window.Highcharts?.charts||[]){if(!chart)continue;
 for(const series of chart.series||[]){
 if(String(series.name).trim().toUpperCase()!=='PC')continue;
 const data=series.options?.data;if(!Array.isArray(data)||data.length<2)continue;
 const valid=data.filter(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isInteger(p[1])&&p[1]>=150&&p[1]<=15000000&&p[0]>=Date.UTC(2026,0,1)&&p[0]<=Date.now()+60000).sort((a,b)=>a[0]-b[0]);
 if(valid.length<2)continue;
 const steps=valid.slice(1).map((p,i)=>p[0]-valid[i][0]).filter(d=>d>0).sort((a,b)=>a-b);const step=steps[Math.floor(steps.length/2)];
 const kind=step===86400000?'daily':step===3600000?'hourly':null;if(!kind)continue;
 for(const p of valid)points.push({updated_at:new Date(p[0]).toISOString(),price:p[1],kind});
 }}
 const value={card_id:id,points:[...new Map(points.map(p=>[p.kind+p.updated_at,p])).values()].slice(-5000)};
 if(!value.points.length)return;const key=JSON.stringify(value);if(key===fingerprint)return;fingerprint=key;
 window.postMessage({type:'fcscanner-pc-history',...value},location.origin);
},5000);

// Public read-only configuration. Never use a service-role key here.
const root='https://ztxbktelvqfisafywmvx.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_-r1TbaNpDb4tD-sdFwf4kg_btsGHHkX'};
async function read(path){
 const response=await fetch(root+path,{headers,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Supabase: HTTP '+response.status);
 return response.json();
}
export async function loadMarket(){
 const rows=[];let offset=0;
 for(;;){const page=await read('fcscanner_prices?select=*&order=updated_at.asc,card_id.asc&limit=1000&offset='+offset);rows.push(...page);if(page.length<1000)break;offset+=page.length;if(offset>=100000)throw Error('Historia wymaga paginacji po stronie serwera.');}
 const averages=[];offset=0;
 for(;;){const page=await read('fcscanner_average_history?select=*&order=observed_at.asc,card_id.asc,interval_kind.asc&limit=1000&offset='+offset);averages.push(...page);if(page.length<1000)break;offset+=page.length;if(offset>=100000)throw Error('Historia średnich przekracza limit odczytu.');}
 const raw=await read('fcscanner_events?select=*&order=starts_at.desc&limit=1000');
 const events=raw.map(e=>({requirements:e.requirements,id:e.id,title:e.title,type:e.type,scope:e.scope==='cards'?'ids':e.scope,ids:e.card_ids,start:Date.parse(e.starts_at),end:Date.parse(e.ends_at),created:Date.parse(e.created_at),url:e.source_url??'',cloud:true}));
 return {rows,events,averages};
}

window.addEventListener('message',e=>{
 if(e.source!==window||e.origin!==location.origin||e.data?.type!=='fcscanner-pc-history')return;
 const id=location.pathname.match(/^\/27\/player\/(\d+)(?:\/|$)/)?.[1];
 if(!id||e.data.card_id!==id||!Array.isArray(e.data.points)||!e.data.points.length||e.data.points.length>5000)return;
 chrome.runtime.sendMessage({type:'pc-history',card:{game:'fc27',platform:'pc',card_id:id,name:document.title.replace(/\s*[-|].*$/,'').replace(/ EA FC 27.*$/i,'').slice(0,150),source_url:location.href},points:e.data.points});
});

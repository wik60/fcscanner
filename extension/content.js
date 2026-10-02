// Only visible PC-scoped price nodes. No console/manual fallback.
let timer,lastKey='';
function read(){
 const match=location.pathname.match(/^\/27\/player\/(\d+)(?:\/|$)/);if(!match)return;
 const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const nodes=[...document.querySelectorAll('.platform-pc-only .lowest-price-1')].filter(visible);
 const prices=nodes.map(e=>{const s=e.textContent.replace(/[,\s]/g,'').toUpperCase();if(!/^\d+(?:\.\d+)?[KM]?$/.test(s))return null;const n=parseFloat(s)*(s.endsWith('M')?1e6:s.endsWith('K')?1e3:1);return Number.isInteger(n)&&n>=150&&n<=15000000?n:null;});
 const unique=[...new Set(prices.filter(n=>n!==null))];if(!nodes.length||prices.some(p=>p===null)||unique.length!==1)return;
 const key=match[1]+':'+unique[0];if(key===lastKey)return;lastKey=key;
 chrome.runtime.sendMessage({type:'pc-observation',row:{game:'fc27',platform:'pc',card_id:match[1],name:document.title.replace(/\s*[-|].*$/,'').replace(/ EA FC 27.*$/i,'').slice(0,150),version:'Card '+match[1],market_price:unique[0],updated_at:new Date().toISOString(),source_url:location.href}},()=>{if(chrome.runtime.lastError)lastKey='';});
}
function schedule(){clearTimeout(timer);timer=setTimeout(read,2000);}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});
schedule();
